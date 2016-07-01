// We use the promise library because it allows us to run in series.
const Promise = require('bluebird');
const PEG = require('pegjs');

const script = `get /
fill username bill
fill password password
pressButton Login
get /links
`;
//  times 3 ( get / )

const parserArguments = `
start 
  = nl* first:line rest:(nl+ data:line { return data; })* nl* { 
    rest.unshift(first); return rest;
  }
    
line = space first:command tail:(" " argument)* {
  var params = [];
  for (var i = 0; i < tail.length; i++) {
    params.push(tail[i][1]);
  }
  return {type:'CallExpression', operator:first, params: params}
}
//
argument "argument"
  = func / JSON / number / string
command "command"
= head:[^\\t\\n\\r )]* {
  return {type:"word", name:head.join("")};
}
func = "(" space space first:command tail:(" " argument)* space ")" {
  var params = [];
  for (var i = 0; i < tail.length; i++) {
    params.push(tail[i][1]);
  }
  return {type:'DelayExpression', operator:first, params: params}

 }
string "string" = s:[^\\t\\n\\r() ]+ {
  return {type:"value", value:s.join("")};
}
number "number" = num:[0-9]+ {
return {type: "value", value:parseInt(num.join(""), 10)};
}
comment "comment"
 = "#"+ [^\\n\\r]* { return ''; }
JSON = head:("{" $[^}]* "}") { 
  return {type:"value", value:head.join("")};
}
space "space" 
  = [ ]*
_ "whitespace"
  = [ \\t\\n\\r]*
nl "newline"
 = [\\n\\r]
`;

const parser = PEG.buildParser(parserArguments.trim());

const actions = parser.parse(script.trim());

console.log(actions);

const Browser = require('zombie');
Browser.localhost('localhost', 3000);

const browser = new Browser();

const env = {
  multi: (arg1, arg2) => new Promise((resolve, reject) => resolve(arg1 * arg2)),
  plus: (arg1, arg2) => new Promise((resolve, reject) => resolve(arg1 + arg2)),
  times: (times, expr) => {
    console.log('expr', expr);
    return evaluate(times).then((n) => {
      const promiseList = [];
      for (let i = 0; i < n; i++) {
        promiseList.push(expr);
      }
      return Promise.resolve(promiseList);
    })
    .mapSeries((a) => evaluate(a))
    .then((added) => Promise.resolve(browser));
  },
  get: (path) =>
    new Promise((resolve, reject) => {
      console.log('visiting:', path);
      browser.visit(path).then(() => resolve(browser));
    }),
  fill: (selector, value) =>
    new Promise((resolve, reject) => {
      console.log('filling:', selector, 'with ', value);
      browser.fill(selector, value);
      resolve(browser);
    }),
  pressButton: (selector) =>
    new Promise((resolve, reject) => {
      console.log('pressing:', selector);
      browser.pressButton(selector).then(() => resolve(browser));
    }),
};

const evaluate = (action) => {
  if (action.type === 'value') {
    return Promise.resolve(action.value);
  }

  if (action.type === 'word') {
    if (action.name in env) {
      return env[action.name];
    }
    return Promise.reject('Undefined variable: ${action.name}');
  }

  if (action.type === 'CallExpression') {
    const op = evaluate(action.operator);
    if (typeof op !== 'function') {
      return Promise.reject('Applying a non-function.');
    }
    return Promise.mapSeries(action.params, (a) => evaluate(a))
      .then((resolvedParameters) => op.apply(null, resolvedParameters));
  }
  //  Hand expression on without evaluation.
  if (action.type === 'DelayExpression') {
    const op = evaluate(action.operator);
    return op.apply(null, action.params);
  }
  return Promise.reject('Unknown type: ${action.type}');
};

// console.log(sequence(actions));
Promise.mapSeries(actions,
  (action) => {
    console.log('evaluating:', action.operator.name);
    return evaluate(action).then((ret) => console.log(ret.location._url));
  })
  .then((data) => console.log('result:', data))
  .catch((fail) => console.log('failed for reason', fail));
