Emathquiz
==============

See the [demo page](http://e-math.github.com/emathquiz).

What?
-----
A tool for creating quizes in web pages.

How?
----
Emathquiz is a jQuery-plugin and can be embedded on any web page
by including `jquery.emathquiz.js`-file and defining some html-element
as a quiz with: `$('#mydiv').emathquiz(data)`.

Emathquiz depends on external JavaScript libraries:
* MathQuill
* jQuery
* JSXGraph

Who?
----
The tool was developed in EU-funded [E-Math -project](http://emath.eu) by
* Petri Salmela
* Petri Sallasmaa

and the copyrights are owned by [Four Ferries oy](http://fourferries.fi).

License?
--------
The tool is licensed under [GNU AGPL](http://www.gnu.org/licenses/agpl-3.0.html).
The tool depends on some publicly available open source components with other licenses:
* [jQuery](http://jquery.com) (MIT-license)
* [MathQuill](http://mathquill.com/) (GNU LGPL)
* [JSXGraph](http://jsxgraph.uni-bayreuth.de/) (GNU LGPL and MIT-license)



Usage
======
A quiz gets the questions as an array of questionsets. Questionsets on the other hand
are functions that return random questionobjects. Questionobject is a javascript object
including question text, possible picture (instructions, how to draw it with JSXGraph),
feedback for correct and wrong answers and a function that checks the answer. Object can
also include set of multichoise answers, or whatever the questiontype needs.

Initing a quiz
----
Init a new quiz with two built-in questionsets

```javascript
jQuery('#box').emathquiz({
    title: "Angles of triangles",
    overlay: false,
    func: [Quizes.triangletype_image, Quizes.triangle_multi]
});
```
For more examples see the [demo page](http://e-math.github.com/emathquiz).
