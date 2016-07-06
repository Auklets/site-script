//  Create a global env for this language to live in.
const globalEnv = Object.create(null);


const globalFunctions = {
  mult: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 * arg2)),
  add: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(+arg1 + +arg2)),
  eq: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 === arg2)),
  lt: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 < arg2)),
  gt: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 > arg2)),
  lte: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 <= arg2)),
  gte: (arg1, arg2, env) => new Promise((resolve, reject) => resolve(arg1 >= arg2)),
  log: (arg1, env) => new Promise((resolve, reject) => resolve(console.log(arg1))),
  set: (variableName, primitiveValue, env) => {
    return new Promise((resolve, reject) => {
      if (variableName in env) {
        let searchEnv = env;
        while (!Object.prototype.hasOwnProperty.call(searchEnv, variableName)) {
          searchEnv = Object.getPrototypeOf(searchEnv);
        }
        searchEnv[variableName] = primitiveValue;
      } else {
        env[variableName] = primitiveValue;
      }
      return resolve();
    });
  },
  get: (path, env) =>
    new Promise((resolve, reject) => {
      // console.log('visiting:', path);
      const startTime = new Date();
      env.browser.visit(path).then((blah) => {
        const endTime = new Date();
        env.responseTimes.push({
          actionName: `get ${path}`,
          path: env.browser.request.url,
          statusCode: env.browser.response.status,
          elapsedTime: endTime - startTime,
          httpVerb: env.browser.request.method,
        });
        resolve(env.browser);
      });
    }),
  fill: (selector, value, env) =>
    new Promise((resolve, reject) => {
      // console.log('filling:', selector, 'with ', value);
      env.browser.fill(selector, value);
      resolve(env.browser);
    }),
  pressButton: (selector, env) =>
    new Promise((resolve, reject) => {
      // console.log('pressing:', selector);
      const startTime = new Date();
      env.browser.pressButton(selector).then(() => {
        const endTime = new Date();
        env.responseTimes.push({
          actionName: `pressButton ${selector}`,
          path: env.browser.request.url,
          statusCode: env.browser.response.status,
          elapsedTime: endTime - startTime,
          httpVerb: env.browser.request.method,
        });
        resolve(env.browser);
      });
    }),
};
// Copy the functions from the global functions into the naked object.
Object.keys(globalFunctions).forEach((key) => (globalEnv[key] = globalFunctions[key]));
module.exports = globalEnv;
