const Promise = require('bluebird');
const axios = require('axios');
const _ = require('lodash');

const signale = require('signale');
const chalk = require('chalk');
const ora = require('ora');

const fs = require('../../utils/fs-promise');

const getter = require('./getter');

// 1137100  axios(`https://www.trivago.co.id/api/v1/_cache/accommodation/${value}/ratings.json?requestId=v12_10_5_ab_id_ID_UK`)

const scrapeTrivago = async chunk => {
  const promises = chunk.map(value =>
    axios
      .get(
        `https://www.trivago.co.id/api/v1/_cache/accommodation/${value}/ratings.json?requestId=v12_10_5_ab_id_ID_UK`
      )
      .then(async result => [value, result.data])
      .catch(() => [value, false])
  );

  try {
    return await Promise.all(promises);
  } catch (e) {
    signale.fatal(e);
  }
};

const scrapingAction = async (folder, chunk) => {
  try {
    const res = await scrapeTrivago(chunk);
    return res.map(([id, value]) => {
      const reviews = getter.reviews(value);
      const selectedLang = getter.selectedLang(value);

      if (!value || _.isEmpty(reviews) || selectedLang !== 'en') {
        return Promise.resolve(false);
      }

      const normalizedReview = reviews.map(review => review.text);

      return fs.writeFileAsync(
        `./${folder}/${id}.json`,
        JSON.stringify(normalizedReview, null, 2),
        'utf8'
      );
    });
  } catch (e) {
    signale.fatal(e);
  }
};

module.exports = async (folder, minRange, maxRange) => {
  const spinnerAllChunks = ora(
    chalk.red(`${chalk.underline.bgBlue('SCRAPING')} Data!\n`)
  ).start();

  try {
    const isDirCreated = await fs.existsAsync(folder);
    if (!isDirCreated) await fs.mkdirAsync(folder);

    await _.chunk(_.range(minRange, maxRange, 2), 5).reduce(
      (promise, chunk) =>
        promise.then(() => {
          signale.info(
            chalk.red(
              `${chalk.underline.bgBlue('SCRAPING')} chunks no: ${chunk} \n`
            )
          );

          return Promise.all([
            Promise.delay(2000),
            scrapingAction(folder, chunk),
          ]);
        }),
      Promise.resolve()
    );

    spinnerAllChunks.succeed(
      chalk.green(`${chalk.underline.bgBlue('SCRAPING')} Done!`)
    );
  } catch (e) {
    signale.fatal(e);
  }
};
