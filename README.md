# site-script

Building your own DSL (Domain Specific Language) built on Javascript is surprisingly easy.  Some of 
the resources I used are at the bottom. Check them out.

The high level goal was to write a language that a end user could use to script navigating a web page.
That language is translated that into a Abstract Syntax Tree is interpreted to script a headless
browser(zombie in this case).  Running a headless browser felt more like an authentic load test on
a web server instead of just POSTs and GETs.  It also allowed us to script interactions with the
page, clicking on things, submitting forms, etc.

Are there other (possibly better and less tortured) ways to do this?  Of course, executing casperjs probably would have
been easier.

Some of the difficulties with using this interpreter was that these transactions need to be
done in order, but with asynchronous calls.  So each of the functions returns a promise, allowing
the functions to resolve their arguments before being applied.





Some of the resources I used are here:

Highly recommend this resource.  I started here to better understand the basics.
http://eloquentjavascript.net/11_language.html

Covers many different parts of a language.
http://lisperator.net/pltut/

This is mostly about building a compiler and compiling one language to another.  He has
a video where he presents it too.
https://github.com/thejameskyle/the-super-tiny-compiler