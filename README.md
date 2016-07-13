# site-script DSL

site-script is a Domain Specific language built on Javascript.

The high level goal was to write a language that a end user could use to script navigating a web page.
That language is translated that into a Abstract Syntax Tree that is interpreted to script a headless
browser(zombie.js).  Running a headless browser felt more like an authentic load test on
a web server than scripted POSTs and GETs.  It also allowed the language to script interactions with the
page, clicking on things, submitting forms, etc.

Are there other (possibly better and less tortured) ways to do this?  Of course, executing casperjs
scripts probably would have been easier.

Some of the difficulties with using this interpreter was that these transactions need to be
done in order, but with asynchronous calls.  So each of the functions returns a promise, allowing
the functions to resolve their arguments before being applied.

### Overview
site-script allows the scripting of of a limited subset of zombiejs to duplicate the user interactions.  Here are the available commands.

Here is an example of a script to sign up, log in, and create
a couple of things:

```
set u (randomstring 10)
set p (randomstring 10)

get /
get /signup
fill username $u
fill password $p
pressButton 'Sign up'
get /logout
fill username $u
fill password $p
pressButton Login
set x 0
while(lte $x 4) {
  get /create
  fill url https://google.com
  pressButton Shorten
  set x (add $x 1)
}
get /logout
```

### API
```
get [path]
Navigates to the path on the specified server.
examples:
get /
get /signup
```
```
pressButton [buttonText]
Presses the button on the page.
examples:
pressButton 'Submit'
pressButton 'Log In'
```
```
fill [selector, value]
inputs text into a field.
examples:
fill username 'bill'
fill password '1234'
```

```
set [variable name] [value]
set creates a variable and assigns it a value.
examples:
set x 1
set x 'hi'

x can now be referred to with a $ to access the value.

set can also take the value of a expression:
set (add $x 1)
```

```
randomstring [length]
returns a random string of the specified length.  Currently softly restricts to 24 or less size.  Useful for filling out random user names and passwords.
```

##### Math and Comparators
```
mult [value1 value2]
return the value of the two variables multiplied together.

add [value1 value2]
return the value of the two variables added together

eq [value1 value2]
return true or false depending on equality

lt [value1 value2]
return true/false depending on whether the first value is less than the second value.

lte [value1 value2]
return true/false depending on whether the first value is less than or equal to  the second value.

gt [value1 value2]
return true/false depending on whether the first value is greater than the second value.

gte [value1 value2]
return true/false depending on whether the first value is greater than or equal to the second value.
```


##### Control Statements
```
if and while are both available in the format:

if([expression]) {
...
}
while([expression]) {
...  
}

expression in this case takes on the form of
(lte $x 5)
using the comparators lte, gte, lt, or gt

variables created in while and if statements will not be available elsewhere,  
however parent variables are accessible

```

##### Functions
```
Define your own Functions
func functionName([arg1],[arg2]...) {

}
and call it
functionName('hi')

Values scoped in functions are only available in those functions.  Parent variables are accessible.
```




Some of the resources I used are here:

Highly recommend this resource.
http://eloquentjavascript.net/11_language.html

Covers many different parts of a language.
http://lisperator.net/pltut/

This is mostly about building a compiler and compiling one language to another.
https://github.com/thejameskyle/the-super-tiny-compiler
https://www.youtube.com/watch?v=Tar4WgAfMr4
