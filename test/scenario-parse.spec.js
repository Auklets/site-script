/* eslint-env mocha */
const should = require('chai').should();
const parser = require('../parser.js');

describe('Parse should understand the syntax and fail appropriately', () => {
  it('will fail on mismatched bracket', () => {
    const script = `while (lte $x 4) {`;
    (() => parser.parse(script.trim())).should.throw('SyntaxError');
  });

  it('will fail on mismatched paren', () => {
    let script = 'set x (add $x 1)';
    (() => parser.parse(script.trim())).should.not
      .throw('SyntaxError');

    script = 'set x (add $x 1';
    (() => parser.parse(script.trim())).should.throw('SyntaxError');
  });

  it('parse every script structure type', () => {
    const script = `
set u (randomstring 10)
get /
while(lte $x 4) {
  set x (add $x 1)
}
if(lte $x 5) {
  pressButton 'Sign up'
}
func test(number) {
  fill password $p  
}
    `;
    (() => parser.parse(script.trim())).should.not.throw('SyntaxError');
  });
});

describe('Parse should get the correct number of commands and arguments', () => {
  it('understands 1 - 3 commands', () => {
    const initial = 'get /';
    let script = initial;
    for (let i = 1; i <= 3; i++) {
      parser.parse(script).should.have.length(i);
      script += '\r\n' + 'initial';
    }
  });

  it('understands 0 - 3 arguments', () => {
    for (let i = 0; i <= 3; i++) {
      // generate a array string of i size, with values 1,2,3....
      const script = 'get ' + Array.apply(0, Array(i)).map((x, y) => y + 1).join(' ');
      // check the size of the returned params array for the first command
      parser.parse(script.trim())[0].params.should.have.length(i);
    }
  });
});

describe('Parse should get the correct action and arguments', () => {
  it('gets the function name', () => {
    const script = 'get /';
    parser.parse(script.trim())[0].operator.should.equal('get');
  });
  it('gets both strings with spaces between single quotes', () => {
    const script = 'site \'space arg\' arg';
    parser.parse(script.trim())[0].params[0].value.should.eql('space arg');
  });
});
