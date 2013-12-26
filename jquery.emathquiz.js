//{{{
/*********************************************************
 * jquery.emathquiz.js
 * jQuery-plugin for quizes with interactive images
 * Petri Salmela
 * Petri Sallasmaa
 * 30.12.2012
 * License: AGPL
 ********************************************************/

 var testilogit = {};
(function($){

    /**
     * emathquiz
     * @param options
     */

    $.fn.emathquiz = function(options){
        if (methods[options]){
            return methods[options].apply( this, Array.prototype.slice.call( arguments, 1));
        } else if (typeof(options) === 'object' || !options) {
            return methods.init.apply(this, arguments);
        } else {
            $.error( 'Method ' +  method + ' does not exist on emathquiz' );
            return this;
        }
    }

    var methods = {
        init: function( options ){
            var settings = $.extend({
                autonext: true,
                score: 0,
                total: 0
            }, options);

            return this.each(function(){
                var emquiz = new EmathQuiz(this, settings);
                emquiz.init();
            });
        },
        score: function(){
            // Return the scores as {correct: <number>, total: <number>}
            return this.eq(0).data('emathquiz');
        }
    };


    var EmathQuiz = function(place, settings){
        // Create EmathQuiz-object. Put empty html-elements in the place and
        // find some elements that are needed later.
        testilogit.emq = this;
        this.place = $(place);
        this.settings = settings;
        this.lang = this.settings.lang || this.place.attr('lang') || this.place.parents('[lang]').eq(0).attr('lang') || 'en';
        this.dict = {};
        // Keep the score
        this.totalquestions = this.settings.total;
        this.correctanswers = this.settings.score;
        var htmlcontent = '<div class="emathquizwrapper"><div class="emquiz-title"></div>'
            +'<div class="emquiz-picarea"></div><div class="emquiz-question">'
            +'<div class="emquiz-question-textarea"></div>'
            +'<div class="emquiz-question-answersarea"></div>'
            +'<div class="emquiz-feedbackarea"></div>'
            +'<div class="emquiz-controlarea"></div></div></div>';
        this.place.html(htmlcontent);
        this.wrapper = this.place.find('.emathquizwrapper');
        this.wrapper.addClass('emquiz-gradblue');
        if (this.settings.overlay){
            // If we use quiz as overlay instead of inline.
            this.wrapper.addClass('emquizoverlay')
        }
        // Place for title
        this.titlearea = this.place.find('.emquiz-title');
        // Place for picture
        this.picarea = this.place.find('.emquiz-picarea');
        this.quizid = -1;
        while ($('#emquiz-picarea-'+(++this.quizid)).length > 0){};
        this.picarea.attr('id','emquiz-picarea-'+this.quizid);
        // Place for question text
        this.qtextarea = this.place.find('.emquiz-question-textarea');
        // Place for answer
        this.qanswersarea = this.place.find('.emquiz-question-answersarea');
        // Place for feedback
        this.feedbackarea = this.place.find('.emquiz-feedbackarea');
        // Place for controls like "answer" and "next" buttons and "scores"
        this.controlarea = this.place.find('.emquiz-controlarea');
        this.controlarea.html('<div class="emquiz-resultarea">'+this.correctanswers+'/'+this.totalquestions+'</div>'
            +'<a href="javascript:;" class="emquiz-answerbutton emquiz-button">OK</a>'
            +'<a href="javascript:;" class="emquiz-nextbutton emquiz-button">&raquo;</a>');
        this.resultarea = this.controlarea.find('.emquiz-resultarea');
        
        // Put css in use.
        $('head style#emathquizcss').remove();
        $('head').append('<style id="emathquizcss" type="text/css">'+this.strings.css+'</style>')
    }
    
    EmathQuiz.prototype.init = function(){
        // Init the quiz from options given.
        var emquiz = this;
        // Put the title on its place
        this.title = this.settings.title || '';
        this.titlearea.html('<h1>'+this.title+'</h1>');
        
        // Check the type of given action function: 'function', 'string' or 'array' of functions.
        if (typeof(this.settings.func) === 'function'){
            // Function is given as function
            this.nextquestion = this.settings.func;
        } else if (typeof(this.settings.func) === 'string'){
            // Function is given as a string of javascript code
            try {
                this.nextquestion = new Function(this.settings.func);
            } catch (err){
                $.error('Emathquiz: error in nextquestion function.');
            }
        } else if (typeof(this.settings.func) === 'object' && typeof(this.settings.func.length) === 'number'){
            // Functions are given as an array of functions. Either strings of functions.
            var nfuncs = [];
            for (var i = 0; i < this.settings.func.length; i++){
                if (typeof(this.settings.func[i]) === 'function'){
                    nfuncs.push(this.settings.func[i]);
                } else if (typeof(this.settings.func[i]) === 'string'){
                    try {
                        nfuncs.push(new Function(this.settings.func[i]));
                    } catch (err){
                        $.error('Emathquiz: error in nextquestion function.');
                    }
                }
            }
            this.settings.func = nfuncs;
            this.nextquestion = function(){
                return emquiz.settings.func[Math.floor(Math.random()*emquiz.settings.func.length)].call(this);
            }
        } else {
            // No function was given. Use default example question.
            this.nextquestion = this.defaultQuestion;
        }
        
        // Init some events. ('Answer' and 'Next' buttons)
        this.initEvents();
        
        // Start the next (first) question.
        this.update();
    }
    
    EmathQuiz.prototype.initEvents = function(){
        // Init some events. ('Answer' and 'Next' buttons)
        var emquiz = this;
        this.controlarea.find('a.emquiz-answerbutton').click(function(){
            emquiz.checkAnswer();
        });
        
        this.controlarea.find('a.emquiz-nextbutton').click(function(e){
            e.stopPropagation();
            e.preventDefault();
            if (emquiz.nexttimeout){
                clearTimeout(emquiz.nexttimeout);
            }
            emquiz.update();
            return false;
        })
    }
    
    EmathQuiz.prototype.update = function(){
        // Start next round by generating next question and using it.
        var emquiz = this;
        this.wrapper.removeClass('emquiz-correctanswer');
        this.controlarea.find('a.emquiz-answerbutton').show()
            .end().find('a.emquiz-nextbutton').hide();
        // Get data for next question.
        this.question = this.nextquestion();
        // Set the style
        this.question.qstyle = this.question.qstyle || 'default';
        this.wrapper.attr('qstyle', this.question.qstyle).attr('qtype', this.question.qtype);
        // Clear the feedback
        this.feedbackarea.empty().removeClass('emquiz-feedback-correct emquiz-feedback-wrong');
        // Show the question. Show math with mathquill.
        this.qtextarea.html(this.question.qtext.replace(/\\\(/g, '<span class="mathquill-embedded-latex">').replace(/\\\)/g, '</span>'))
            .find('.mathquill-embedded-latex').mathquill('embedded-latex');
            
        // Init the answering section according to the type of question (multichoice, shortanswer)
        var answers = '';
        switch (this.question.qtype){
            case 'multichoice':
                // Show multichoice answers
                answers = '<ul class="emquiz-multichoice">';
                for (var i = 0; i < this.question.qanswers.length; i++){
                    answers += '<li><input type="radio" name="emquiz-'+this.quizid +'-multichoice" id="emquiz-'
                        +this.quizid+'-multichoice-'+i+'" value="'+i+'" />';
                    answers +='<label for="emquiz-'+this.quizid+'-multichoice-'+i+'">'
                        +this.question.qanswers[i]
                            .replace(/\\\(/, '<span class="mathquill-embedded-latex">')
                            .replace(/\\\)/, '</span>')+'</label></li>';
                }
                answers += '</ul>'
                break;
            case 'shortanswer':
                // Show the answering field for short answer.
                answers = '<div class="emquiz-shortanswer">';
                answers += '<span class="emquiz-shortanswer-useranswer mathquill-editable"></span>';
                answers += '</div>';
                break;
            case 'image':
                // Show (don't show) the answering widgets for image quiz.
            default:
                break;
        }
        
        // Show math with mathquill
        this.qanswersarea.html(answers).find('.mathquill-editable').mathquill('editable').focus().keydown(function(e){
                if (e.which === 13){
                    emquiz.controlarea.find('a.emquiz-answerbutton').click();
                }
            }).end().find('.mathquill-embedded-latex').mathquill();
        if (this.settings.autonext){
            this.qanswersarea.find('input[type="radio"]').change(function(e){
                if (emquiz.answertimeout){
                    clearTimeout(emquiz.answertimeout);
                }
                emquiz.answertimeout = setTimeout(function(){
                    emquiz.controlarea.find('a.emquiz-answerbutton').click();
                    emquiz.nexttimeout = setTimeout(function(){emquiz.controlarea.find('a.emquiz-nextbutton').click();}, 5000);
                }, 1000);
            });
        }

        // Show or hide picarea.
        if (this.question.haspicture){
            this.wrapper.addClass('emquiz-haspicture');
        } else {
            this.wrapper.removeClass('emquiz-haspicture');
        }
        // Draw the picture with jsxgraph+jessiescript, if this.question.jessie exists.
        if (this.question.jessie){
            this.picarea.empty();
            this.construction = [];
            var jxgoptions = JXG.Options;
            // Some default settings for picture.
            JXG.Options = JXG.deepCopy(JXG.Options, {
                showNavigation: false,
                text: {
                    fontSize: 20
                },
                angle: {
                    radius: 1.1,
                    label: {
                        strokeColor: '#ff0000'
                    },
                    orthoSensitivity: 0.5
                },
                point: {
                    fixed: true,
                    size: 1.3
                },
                glider: {
                    fixed: false,
                    color: '#f00',
                    size: 5,
                    strokeColor: 'black',
                    strokeWidth: 3,
                    face: 'x'
                },
                line: {
                    strokeWidth: 3,
                    shadow: true
                }
             });
            // Init the board
            if (this.board){
                JXG.JSXGraph.freeBoard(this.board);
            }
            this.board = JXG.JSXGraph.initBoard("emquiz-picarea-"+this.quizid, {
                boundingbox: this.question.jessiebb || [0,10,10,0],
                keepaspectratio: true,
                grid: true,
                showCopyright: false,
                showNavigation: false,
                pan: false,
                zoom: false
            });
            this.construction = [];
            this.board.suspendUpdate();
            this.construction['question'] = this.board.construct(this.question.jessie);
            if (this.question.lblabels){
                for (var i = 0; i < this.question.lblabels.length; i++){
                    this.board.elementsByName[this.question.lblabels[i]].label.content.setProperty({offset: [-20,-20]});
                }
            }
            if (this.question.ltlabels){
                for (var i = 0; i < this.question.ltlabels.length; i++){
                    this.board.elementsByName[this.question.ltlabels[i]].label.content.setProperty({offset: [-20,20]});
                }
            }
            if (this.question.rblabels){
                for (var i = 0; i < this.question.rblabels.length; i++){
                    this.board.elementsByName[this.question.rblabels[i]].label.content.setProperty({offset: [10,-20]});
                }
            }
            if (this.question.rtlabels){
                for (var i = 0; i < this.question.rtlabels.length; i++){
                    this.board.elementsByName[this.question.rtlabels[i]].label.content.setProperty({offset: [10,20]});
                }
            }
            if (this.question.jessiestyles && this.question.jessiestyles['question']){
                this.setJsxProperty('question');
            }
            if (this.question.jessielabels && this.question.jessielabels['question']){
                this.setJsxLabels('question');
            }
            this.board.unsuspendUpdate();
            testilogit.board = this.board;
            testilogit.construction = this.construction;
            JXG.Options = jxgoptions;
        }
    }
    
    EmathQuiz.prototype.setJsxProperty = function(elementset, ruleset){
    /**
     * @param String elementset - the name of construction set of jsxelements
     * @param String ruleset - the name of set of style rules for jsxelements. If null, then use elementset.
     */
        ruleset = ruleset || elementset;
        for (var elems in this.question.jessiestyles[elementset]){
            if (typeof(this.construction[elementset][elems].length) === 'undefined'){
                this.construction[elementset][elems].setProperty(this.question.jessiestyles[ruleset][elems]);
            } else {
                for (var i = 0, length = this.construction[elementset][elems].length; i < length; i++){
                    this.construction[elementset][elems][i].setProperty(this.question.jessiestyles[ruleset][elems]);
                }
            }
        }
    }
    
    EmathQuiz.prototype.setJsxLabels = function(elementset, labelset){
    /**
     * @param String elementset - the name of construction set of jsxelements
     * @param String labelset - the name of set of labels for jsxelements. If null, then use elementset.
     */
        labelset = labelset || elementset;
        var labels = this.question.jessielabels[elementset];
        var construction = this.construction[elementset];
        for (var elem in labels){
            if (construction[elem] && typeof(construction[elem].length) === 'undefined'){
                this.construction[elementset][elem].label.content.setText(labels[elem](construction));
            }
        }
    }
    
    EmathQuiz.prototype.localize = function(text){
        var result;
        if (this.dict[text]){
            if (this.dict[text][this.lang]){
                result = this.dict[text][this.lang];
            }
            result = result || this.dict[text]['en'];
        }
        result = result || text;
        return result;
    }
    
    EmathQuiz.prototype.defaultQuestion = function(){
        // "Dummy" default function for questions, if real question function is not given.
        // Returns randomly either multichoice question or short answer question.
        var questions = [
            {
                qtype: 'multichoice',
                qtext: '<p>Mikä on vastaus?</p>',
                qanswers: [
                    'Eka \\(\\beta\\)',
                    'Toka \\(\\frac{1}{2}\\)',
                    'Kolmas',
                    'Neljäs: Tähän oikein pitkä vastaus. Vaikka jotain lorem ipsumia.'
                ],
                correct: '2',
                jessie: 'A(1,2); B(9,3); C(3,8); [A B] nolabel; [BC] nolabel; [C A] nolabel; 45\u00b0=<(B,A,C)',
                lblabels: ['A']
            },
            {
                qtype: 'shortanswer',
                qtext: '<p>Kuinka paljon?</p>',
                correct: [2.5, 3.5],
                check: function(answer, corrects){
                    var result = false;
                    var replacers = [
                        [/\\frac{([^{}]+)}{([^{}]+)}/ig, '(($1)/($2))'],
                        [/\\sqrt{([^{}]+)}/ig, 'Math.sqrt($1)'],
                        [/\\cdot/ig, '*'],
                        [/\\left\(/ig, '('],
                        [/\\right\)/ig, ')'],
                        [/((?:[0-9]+)|(?:\([^\(\)]\)))\^((?:[0-9])|(?:{[0-9]+}))/ig, 'pow($1, $2)'],
                        [/,/ig, '.']
                    ];
                    var oldanswer = '';
                    while (answer !== oldanswer){
                        oldanswer = answer;
                        for (var i = 0; i < replacers.length; i++){
                            answer = answer.replace(replacers[i][0], replacers[i][1]);
                        }
                    }
                    try {
                        var corrfunc = new Function('return ('+ answer +');');
                        for (var i = 0; i < corrects.length; i++){
                            result = result || (corrects[i] == corrfunc());
                        }
                    } catch (err){
                    }
                    return result;
                },
                jessie: 'A(1,2); B(9,3); C(3,8); [A B] nolabel; [BC] nolabel; [C A] nolabel; 45\u00b0=<(B,A,C)',
                lblabels: ['A']
            }
        ]
        return questions[Math.floor(Math.random()*questions.length)];
    }
    
    EmathQuiz.prototype.checkAnswer = function(){
        // Check the answer and show the correct one before continuing
        // to the next one.
        this.wrapper.addClass('emquiz-correctanswer');
        this.controlarea.find('a.emquiz-answerbutton').hide()
            .end().find('a.emquiz-nextbutton').show();
        var correct = false;
        switch (this.question.qtype){
            case 'multichoice':
                this.answer = parseInt(this.qanswersarea.find(':checked').val());
                this.qanswersarea.find('li').eq(parseInt(this.question.correct)).addClass('emquiz-multichoice-correct');
                this.qanswersarea.find('li').eq(parseInt(this.answer)).addClass('emquiz-multichoice-useranswer');
                correct = (this.question.correct === this.answer);
                break;
            case 'shortanswer':
                this.answer = this.qanswersarea.find('.emquiz-shortanswer-useranswer').mathquill('latex') || '';
                var useranswer = this.qanswersarea.find('.emquiz-shortanswer-useranswer');
                useranswer.mathquill('revert').html(this.answer).mathquill('embedded-latex');
                if (typeof(this.question.check) === 'function'){
                    correct = this.question.check(this.answer, this.question.correct);
                } else {
                    for (var i = 0; i < this.question.correct.length; i++){
                        correct = correct || (this.answer == this.question.correct[i]);
                    }
                }
                if (correct){
                    this.qanswersarea.find('.emquiz-shortanswer-useranswer').addClass('emquiz-shortanswer-correct');
                } else {
                    useranswer.after('<div class="emquiz-shortanswer-correct">'+this.question.correct[0]+'</div>');
                }
                break;
            case 'image':
                this.answer = this.question.getAnswer(this.board);
                correct = this.question.check(this.answer, this.question.correct);
                if (!(correct && this.question.jessiehidecorrect)){
                    this.board.suspendUpdate();
                    this.construction['correct'] = this.board.construct(this.question.jessiecorrect);
                    if (this.question.jessiestyles){
                        this.setJsxProperty('question', 'questionafter');
                        this.setJsxProperty('correct');
                    }
                    this.board.unsuspendUpdate();
                }
                break
            default:
                this.answer = '';
                break;
        }
        this.totalquestions++;
        if (correct){
            this.correctanswers++;
        }
        if (this.question.feedback){
            this.feedbackarea.addClass(correct ? 'emquiz-feedback-correct' : 'emquiz-feedback-wrong')
                .html(this.question.feedback
                      .replace(/\\\(/g, '<span class="mathquill-embedded-latex">')
                      .replace(/\\\)/g, '</span>')
                ).find('.mathquill-embedded-latex').mathquill('embedded-latex');
        }
        this.resultarea.html(this.correctanswers +'/'+ this.totalquestions);
        this.controlarea.find('a.emquiz-nextbutton').focus();
        this.place.data('emathquiz', {correct: this.correctanswers, total: this.totalquestions});
        this.place.trigger('changed');
    }
    
    EmathQuiz.prototype.strings = {
        // CSS style rules.
        css: [
            '.emathquizwrapper {border: 1px solid #777; border-radius: 1em; box-shadow: 5px 5px 5px rgba(0,0,0,0.5), inset 2px 2px 4px rgba(255,255,255,0.8), inset -2px -2px 4px black; min-height: 5em; margin: 1em; padding: 0.5em;}',
            '.emathquizwrapper.emquizoverlay {position: fixed; top: 5em; width: 90%; max-width: 1000px; margin: 0 auto; left: 5%; right: 5%;}',
            '.emathquizwrapper:after {content: " "; clear: both; display: block;}',
            '.emquiz-title h1 {color: #005; text-align: center; border: none; margin: 0.2em 0.5em; text-shadow: 1px 1px 2px white, -1px -1px 1px black, 1px 1px 2px white;}',
            '.emquiz-picarea {border: 1px solid #777; border-radius: 5px; background: white; box-shadow: inset 5px 5px 5px rgba(0,0,0,0.2); margin: 5px; display: none;}',
            '[qstyle="default"] .emquiz-picarea {float: left; width: 300px; height: 300px;}',
            '[qstyle="bigpic"] .emquiz-picarea {height: 300px;}',
            '[qstyle="widepic"] .emquiz-picarea {height: 150px;}',
            '.emquiz-haspicture .emquiz-picarea {display: block;}',
            '.emquiz-question {margin: 6px 5px 5px 5px; padding-top: 5px;}',
            '.emquiz-haspicture[qstyle="widepic"] .emquiz-question, .emquiz-haspicture[qstyle="bigpic"] .emquiz-question',
                '{margin: 6px 5px 5px 5px; padding-top: 5px;}',
            '.emquiz-haspicture .emquiz-question {margin: 6px 5px 5px 315px;}',
            '.emquiz-question-textarea, .emquiz-question-answersarea, .emquiz-feedbackarea {border: 1px solid #777; border-radius: 5px; background-color: rgba(255,255,255,0.8); padding: 0 1em; margin: 0 0 1em 0; min-height: 2em; box-shadow: inset 4px 4px 6px rgba(0,0,0,0.3);}',
            '[qtype="image"] .emquiz-question-answersarea {display: none;}',
            '.emquiz-feedbackarea {visibility: hidden;}',
            '.emquiz-feedbackarea.emquiz-feedback-correct {background-color: rgb(248,255,232); visibility: visible;}',
            '.emquiz-feedbackarea.emquiz-feedback-wrong {background-color: rgb(254,187,187); visibility: visible;}',
            '.emquiz-feedbackarea p.corrfeedback, .emquiz-feedbackarea p.wrongfeedback {display: none;}',
            '.emquiz-feedbackarea.emquiz-feedback-correct p.corrfeedback, .emquiz-feedbackarea.emquiz-feedback-wrong p.wrongfeedback {display: block;}',
            
            'ul.emquiz-multichoice {list-style: none; padding-left: 1em;}',
            'ul.emquiz-multichoice li {min-height: 2em; padding: 0.5em 0; margin: 0.5em 0;}',
            'ul.emquiz-multichoice li label {padding-left: 2em; vertical-align: base-line; cursor: pointer;}',
            '.emquiz-correctanswer ul.emquiz-multichoice input[type="radio"] {display: none;}',
            '.emquiz-correctanswer ul.emquiz-multichoice li.emquiz-multichoice-correct, .emquiz-correctanswer .emquiz-shortanswer-correct, .emquiz-correctanswer ul.emquiz-multichoice li.emquiz-multichoice-correct.emquiz-multichoice-useranswer',
                '{border-radius: 10px; border: 2px solid #a9c314; box-shadow: 0 0 2px white;',
                'background: rgb(248,255,232);',
                'background: -moz-linear-gradient(top,  rgba(248,255,232,1) 0%, rgba(227,245,171,1) 33%, rgba(183,223,45,1) 100%);',
                'background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,rgba(248,255,232,1)), color-stop(33%,rgba(227,245,171,1)), color-stop(100%,rgba(183,223,45,1)));',
                'background: -webkit-linear-gradient(top,  rgba(248,255,232,1) 0%,rgba(227,245,171,1) 33%,rgba(183,223,45,1) 100%);',
                'background: -o-linear-gradient(top,  rgba(248,255,232,1) 0%,rgba(227,245,171,1) 33%,rgba(183,223,45,1) 100%);',
                'background: -ms-linear-gradient(top,  rgba(248,255,232,1) 0%,rgba(227,245,171,1) 33%,rgba(183,223,45,1) 100%);',
                'background: linear-gradient(to bottom,  rgba(248,255,232,1) 0%,rgba(227,245,171,1) 33%,rgba(183,223,45,1) 100%);',
                'filter: progid:DXImageTransform.Microsoft.gradient( startColorstr=\'#f8ffe8\', endColorstr=\'#b7df2d\',GradientType=0 );}',
            '.emquiz-correctanswer ul.emquiz-multichoice li.emquiz-multichoice-useranswer {border-radius: 10px; border: 2px solid #e81818; box-shadow: 0 0 2px white;',
                'background: rgb(254,187,187);',
                'background: -moz-linear-gradient(top,  rgba(254,187,187,1) 0%, rgba(254,144,144,1) 45%, rgba(255,92,92,1) 100%);',
                'background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,rgba(254,187,187,1)), color-stop(45%,rgba(254,144,144,1)), color-stop(100%,rgba(255,92,92,1)));',
                'background: -webkit-linear-gradient(top,  rgba(254,187,187,1) 0%,rgba(254,144,144,1) 45%,rgba(255,92,92,1) 100%);',
                'background: -o-linear-gradient(top,  rgba(254,187,187,1) 0%,rgba(254,144,144,1) 45%,rgba(255,92,92,1) 100%);',
                'background: -ms-linear-gradient(top,  rgba(254,187,187,1) 0%,rgba(254,144,144,1) 45%,rgba(255,92,92,1) 100%);',
                'background: linear-gradient(to bottom,  rgba(254,187,187,1) 0%,rgba(254,144,144,1) 45%,rgba(255,92,92,1) 100%);',
                'filter: progid:DXImageTransform.Microsoft.gradient( startColorstr=\'#febbbb\', endColorstr=\'#ff5c5c\',GradientType=0 );}',

            '.emquiz-shortanswer {padding: 1em; min-height: 2em;}',            
            '.emquiz-shortanswer .emquiz-shortanswer-correct {display: block; padding: 0.3em 1em; margin: 0.3em 0;}',
            '.emquiz-shortanswer .emquiz-shortanswer-useranswer {display: block; margin: 0.3em; background-color: white; padding: 0.2em;}',
            
            '.emquiz-controlarea {text-align: right; clear: both;}',
            '.emquiz-resultarea {float: left; background-color: rgba(255,255,255,0.8); border: 1px solid #777; border-radius: 5px; min-width: 8em; padding: 0.5em; text-align: center; box-shadow: inset 4px 4px 6px rgba(0,0,0,0.3);}',
            '.emquiz-button, .emathquizwrapper a.emquiz-button:hover {display: inline-block; padding: 0.5em 1em; border-radius: 0.3em; text-decoration: none; margin: 0 0.5em; min-width: 6em;',
                'border: 1px solid black; text-align: center; color: black; font-weight: bold; text-shadow: 1px 1px 1px white;',
                'background: rgb(254,252,234);',
                'background: -moz-linear-gradient(top,  rgba(254,252,234,1) 0%, rgba(241,218,54,1) 100%);',
                'background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,rgba(254,252,234,1)), color-stop(100%,rgba(241,218,54,1)));',
                'background: -webkit-linear-gradient(top,  rgba(254,252,234,1) 0%,rgba(241,218,54,1) 100%);',
                'background: -o-linear-gradient(top,  rgba(254,252,234,1) 0%,rgba(241,218,54,1) 100%);',
                'background: -ms-linear-gradient(top,  rgba(254,252,234,1) 0%,rgba(241,218,54,1) 100%);',
                'background: linear-gradient(to bottom,  rgba(254,252,234,1) 0%,rgba(241,218,54,1) 100%);',
                'filter: progid:DXImageTransform.Microsoft.gradient( startColorstr=\'#fefcea\', endColorstr=\'#f1da36\',GradientType=0 );}',
            '.emquiz-button:hover {box-shadow: 0 0 3px white; color: black;}',
            '.emquiz-nextbutton {display: none;}',
            '.emquiz-correctanswer .emquiz-nextbutton {display: inline-block;}',
            '.emquiz-correctanswer .emquiz-answerbutton {display: none;}',
            
            '.emquiz-gradgray {background: rgb(179,190,173);',
                'background: -moz-linear-gradient(top,  rgba(179,190,173,1) 0%, rgba(223,229,215,1) 60%, rgba(252,255,244,1) 100%);',
                'background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,rgba(179,190,173,1)), color-stop(60%,rgba(223,229,215,1)), color-stop(100%,rgba(252,255,244,1)));',
                'background: -webkit-linear-gradient(top,  rgba(179,190,173,1) 0%,rgba(223,229,215,1) 60%,rgba(252,255,244,1) 100%);',
                'background: -o-linear-gradient(top,  rgba(179,190,173,1) 0%,rgba(223,229,215,1) 60%,rgba(252,255,244,1) 100%);',
                'background: -ms-linear-gradient(top,  rgba(179,190,173,1) 0%,rgba(223,229,215,1) 60%,rgba(252,255,244,1) 100%);',
                'background: linear-gradient(to bottom,  rgba(179,190,173,1) 0%,rgba(223,229,215,1) 60%,rgba(252,255,244,1) 100%);',
                'filter: progid:DXImageTransform.Microsoft.gradient( startColorstr=\'#b3bead\', endColorstr=\'#fcfff4\',GradientType=0 );}',
            '.emquiz-gradblue {background: rgb(135,224,253);,',
                'background: -moz-linear-gradient(top,  rgba(135,224,253,1) 0%, rgba(83,203,241,1) 40%, rgba(5,171,224,1) 100%);',
                'background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,rgba(135,224,253,1)), color-stop(40%,rgba(83,203,241,1)), color-stop(100%,rgba(5,171,224,1)));',
                'background: -webkit-linear-gradient(top,  rgba(135,224,253,1) 0%,rgba(83,203,241,1) 40%,rgba(5,171,224,1) 100%);',
                'background: -o-linear-gradient(top,  rgba(135,224,253,1) 0%,rgba(83,203,241,1) 40%,rgba(5,171,224,1) 100%);',
                'background: -ms-linear-gradient(top,  rgba(135,224,253,1) 0%,rgba(83,203,241,1) 40%,rgba(5,171,224,1) 100%);',
                'background: linear-gradient(to bottom,  rgba(135,224,253,1) 0%,rgba(83,203,241,1) 40%,rgba(5,171,224,1) 100%);',
                'filter: progid:DXImageTransform.Microsoft.gradient( startColorstr=\'#87e0fd\', endColorstr=\'#05abe0\',GradientType=0 );}'
        ].join('\n')
    }   

})(jQuery)

if (typeof(config) !== 'undefined' && typeof(config.macros) !== 'undefined'){
    // Create macro for TiddlyWiki
    config.macros.emathquiz = {
        /******************************
        * Show emathquiz
        ******************************/
        handler: function (place, macroName, params, wikifier, paramString, tiddler)
        {
            /**
             * emathquiz
             * @param params[0] - overlaymode [[modal##button title]] / [[inline]]
             * @param param[1] - init score and total as: [[score##total]] or as empty [[]] (or [[0##0]])
             * @param param[2-(n-1)] - functions to use in format:
             *     triangleanglesum##multichoice  (for function in tiddler part 'emquiz_triangleanglesum##multichoice')
             */
            
            if (params.length < 3){
                wikify('Missing funcquiz.', place, null, tiddler);
                return false;
            }
            var bookpage = {'pageOne': 0, 'pageTwo': 1}[jQuery(place).parents('.bookpage').attr('id')];
            var bookid = EbookPages[bookpage].ebook.bookid;
            var overlayparams = params.shift() || '';
            overlayparams = overlayparams.split('##');
            var overlaymode = (overlayparams[0] === 'modal');
            var title = overlayparams[1];
            var booklang = overlayparams[2] || EbookPages[bookpage].currentlang;
            var initparams = params.shift() || '';
            initparams = initparams.split('##');
            var initscore = parseInt(initparams[0]) || 0;
            var inittotal = parseInt(initparams[1]) || 0;
            var funcs = [];
            for (var i = 0, length = params.length; i < length; i++){
                var functext = store.getTiddlerText(bookid+'_emquiz_'+params[i]) || store.getTiddlerText('emquiz_'+params[i]) || '';
                if (functext){
                    funcs.push(functext);
                }
            }
            var html = '<html><div class="emathquiz-place" lang="'+booklang+'"><a href="javascript:;" class="emathquiz-button">'+title
                +'</a><div class="emathquiz"></div></div></html>';
            if (overlaymode){
                wikify(html, place);
                var emqbutton = jQuery(place).find('a.emathquiz-button').last();
                emqbutton.button({
                    icons: {
                        primary: "em-icon-quiz"
                    }
                });
                emqbutton.click(function(){
                    var backdiv = jQuery(this).next();
                    backdiv.html('<div class="emq-wrapper"></div><a href="javascript:;">x</a>');
                    backdiv.css({
                        'position': 'fixed',
                        'top': '0',
                        'right': '0',
                        'bottom': '0',
                        'left': '0',
                        'background-color': 'rgba(255,255,255,0.9)',
                        'z-index': '201'
                    });
                    var closebutton = backdiv.find('a');
                    closebutton.click(function(){
                        backdiv.empty().css('position', 'static');
                    }).css({
                        'display': 'inline-block',
                        'position': 'absolute',
                        'top': '20px',
                        'right': '20px',
                        'height': '1.5em',
                        'width': '1.5em',
                        'border-radius': '0.4em',
                        'border': '2px solid black',
                        'background': '#f00',
                        'color': 'white',
                        'text-align': 'center',
                        'vertical-align': 'middle',
                        'font-weight': 'bold',
                        'box-shadow': 'inset 2px 2px 3px rgba(255,255,255,0.5), inset -2px -2px 3px rgba(0,0,0,0.5)'
                    });
                    var content = backdiv.find('.emq-wrapper');
                    content.emathquiz({title: title, func: funcs, overlay: overlaymode, lang: booklang});
                });
            } else {
                wikify('<html><div class="emathquiz-place" lang="'+booklang+'"></div></html>', place);
                jQuery(place).find('.emathquiz-place').last()
                    .emathquiz({
                        title: title,
                        func: funcs,
                        overlay: overlaymode,
                        score: initscore,
                        total: inittotal,
                        lang: booklang
                    });
            }
            return true;
        }
    }
}

//}}}








var Quizes = {
    // Example functions for questions.
    triangle_multi: function(){
        this.dict = {
            qtext: {
                'en': '<p>What is the size of angle \\(\\beta\\) (in degrees)?</p>',
                'fi': '<p>Mikä on kulman \\(\\beta\\) arvo asteina?</p>',
                'sv': '<p>Hur stor är vinkeln \\(\\beta\\) (i grader)?</p>',
                'et': '<p>What is the size of angle \\(\\beta\\) (in degrees)?</p>'
            }
        }
        var result = {
            qtype: 'multichoice',
            qtext: this.localize('qtext'),
            lblabels: ['A'],
            haspicture: true
        }
        var correct = Math.floor(Math.random()*95)+25;
        var corners = [Math.floor((180-correct) * (Math.random()*0.5+0.25))];
        corners.push(180-correct-corners[0]);
        var coordinates = {'A': [0,0], 'C': [8/(Math.tan(corners[0]*Math.PI/180)),8]};
        coordinates['B'] = [coordinates['C'][0] + 8/(Math.tan(correct * Math.PI/180)), 0];
        var maxcoord = Math.max(coordinates['A'][0], coordinates['B'][0], coordinates['C'][0]);
        var mincoord = Math.min(coordinates['A'][0], coordinates['B'][0], coordinates['C'][0]);
        var maxcoordy = Math.max(coordinates['A'][1], coordinates['B'][1], coordinates['C'][1]);
        var mincoordy = Math.min(coordinates['A'][1], coordinates['B'][1], coordinates['C'][1]);
        var scale = Math.min(8/(maxcoord - mincoord), 8/(maxcoordy - mincoordy));
        var xoffset = (10 - (scale * (maxcoord-mincoord)))/2;
        var yoffset = (10 - (scale * coordinates['C'][1]))/2;
        coordinates = {
            'A': [xoffset-scale*mincoord+ scale*coordinates['A'][0], yoffset],
            'B': [xoffset-scale*mincoord+ scale*coordinates['B'][0], yoffset],
            'C': [xoffset-scale*mincoord+ scale*coordinates['C'][0], yoffset+scale*coordinates['C'][1]]
        };
        result.jessie = [
            'A('+coordinates['A'][0]+','+coordinates['A'][1]+');',
            'B('+coordinates['B'][0]+','+coordinates['B'][1]+');',
            'C('+coordinates['C'][0]+','+coordinates['C'][1]+');',
            '[AB] nolabel; [BC] nolabel; [CA] nolabel;',
            'beta=<(C,B,A);',
            corners[0]+'\u00b0=<(B,A,C);',
            corners[1]+'\u00b0=<(A,C,B);',
        ].join(' ');
        var answers = [];
        var stopnow = false;
        while (answers.length < 3 && !stopnow){
            var newans = Math.floor(Math.random()*40)-20+correct;
            if (newans > 0 && newans !== correct && answers.indexOf(newans) === -1){
                answers.push(newans);
            }
        }
        answers.push(correct);
        answers.sort(function(a,b){return Math.random()-0.5;});
        result.correct = answers.indexOf(correct);
        for (var i = 0; i < 4; i++){
            answers[i] = answers[i] + '\u00b0';
        }
        result.qanswers = answers;
        return result;
    },
    triangle_short: function(){
        this.dict = {
            qtext: {
                'en': '<p>What is the size of angle \\(\\beta\\) (in degrees)?</p>',
                'fi': '<p>Mikä on kulman \\(\\beta\\) arvo asteina?</p>',
                'sv': '<p>Hur stor är vinkeln \\(\\beta\\) (i grader)?</p>',
                'et': '<p>What is the size of angle \\(\\beta\\) (in degrees)?</p>'
            }
        }
        var result = {
            qtype: 'shortanswer',
            qtext: this.localize('qtext'),
            lblabels: ['A'],
            haspicture: true
        }
        var correct = Math.floor(Math.random()*95)+25;
        var corners = [Math.floor((180-correct) * (Math.random()*0.5+0.25))];
        corners.push(180-correct-corners[0]);
        var coordinates = {'A': [0,0], 'C': [8/(Math.tan(corners[0]*Math.PI/180)),8]};
        coordinates['B'] = [coordinates['C'][0] + 8/(Math.tan(correct * Math.PI/180)), 0];
        var maxcoord = Math.max(coordinates['A'][0], coordinates['B'][0], coordinates['C'][0]);
        var mincoord = Math.min(coordinates['A'][0], coordinates['B'][0], coordinates['C'][0]);
        var maxcoordy = Math.max(coordinates['A'][1], coordinates['B'][1], coordinates['C'][1]);
        var mincoordy = Math.min(coordinates['A'][1], coordinates['B'][1], coordinates['C'][1]);
        var scale = Math.min(8/(maxcoord - mincoord), 8/(maxcoordy - mincoordy));
        var xoffset = (10 - (scale * (maxcoord-mincoord)))/2;
        var yoffset = (10 - (scale * coordinates['C'][1]))/2;
        coordinates = {
            'A': [xoffset-scale*mincoord+ scale*coordinates['A'][0], yoffset],
            'B': [xoffset-scale*mincoord+ scale*coordinates['B'][0], yoffset],
            'C': [xoffset-scale*mincoord+ scale*coordinates['C'][0], yoffset+scale*coordinates['C'][1]]
        };
        result.jessie = [
            'A('+coordinates['A'][0]+','+coordinates['A'][1]+');',
            'B('+coordinates['B'][0]+','+coordinates['B'][1]+');',
            'C('+coordinates['C'][0]+','+coordinates['C'][1]+');',
            '[AB] nolabel; [BC] nolabel; [CA] nolabel;',
            'beta=<(C,B,A);',
            corners[0]+'\u00b0=<(B,A,C);',
            corners[1]+'\u00b0=<(A,C,B);',
        ].join(' ');
        result.correct = [''+correct];
        result.check = function(answer, corrects){
            return (answer === corrects[0] || answer === (corrects + '^{\\circ}'));
        }
        return result;
    },
    segment_image: function(){
        this.dict = {
            qtext: {
                'en': '<p>Move the point \\(P\\) so, that it divides the segment \\(AB\\) in ratio {{{ratio}}}.</p>',
                'fi': '<p>Siirrä pistettä \\(P\\) niin, että se jakaa janan \\(AB\\) suhteessa {{{ratio}}}.</p>',
                'sv': '<p>Flytta punkten \\(P\\), så att den delar sträckan \\(AB\\) i förhållandet {{{ratio}}}.</p>',
                'et': '<p>Move the point \\(P\\) so, that it divides the segment \\(AB\\) in ratio {{{ratio}}}.</p>'
            },
            'correct': {
                'en': 'Correct!',
                'fi': 'Oikein!',
                'sv': 'Rät svar!',
                'et': 'Correct!'
            },
            'wrong': {
                'en': 'Wrong!',
                'fi': 'Väärin!',
                'sv': 'Fel!',
                'et': 'Wrong!'
            },
            'decimal': {
                'en': '.',
                'fi': ',',
                'sv': ',',
                'et': ','
            },
            'length of AB': {
                'en': 'The length of segment \\(AB\\): ',
                'fi': 'Janan \\(AB\\) pituus: ',
                'sv': 'The length of segment \\(AB\\): ',
                'et': 'The length of segment \\(AB\\): '
            },
            'length of AP': {
                'en': 'The length of segment \\(AP\\): ',
                'fi': 'Janan \\(AP\\) pituus: ',
                'sv': 'The length of segment \\(AP\\): ',
                'et': 'The length of segment \\(AP\\): '
            },
            'length of PB': {
                'en': 'The length of segment \\(PB\\): ',
                'fi': 'Janan \\(PB\\) pituus: ',
                'sv': 'The length of segment \\(PB\\): ',
                'et': 'The length of segment \\(PB\\): '
            }
        };
        var scales = [0.5, 1, 2, 3, 4, 5];
        var scale = scales[Math.floor(Math.random()* scales.length)];
        var ap = 1+Math.floor(Math.random() * 8);
        var pb = 1+Math.floor(Math.random() * 8);
        var ab = ap+pb;
        var yscale = ((ab+2)*scale)*75/600;
        var result = {
            qtype: 'image',
            qstyle: 'widepic',
            qtext: this.localize('qtext'),
            ltlabels: ['A'],
            rtlabels: ['B'],
            haspicture: true,
            feedback: '<p class="corrfeedback">'+this.localize('correct')+'</p><p class="wrongfeedback">'+this.localize('wrong')+'</p><p>'+this.localize('length of AB')+(ab * scale).toString().replace('.',this.localize('decimal'))+'<br />'+this.localize('length of AP')+'\\(\\frac{'+ap+'}{'+(ab)+'}\\cdot '+(ab*scale).toString().replace('.',this.localize('decimal'))+'='+(ab*scale*ap/ab).toString().replace('.',this.localize('decimal'))+'\\)<br />'+this.localize('length of PB')+'\\(\\frac{'+pb+'}{'+(ab)+'}\\cdot '+(ab*scale).toString().replace('.',this.localize('decimal'))+'='+(ab*scale*pb/ab).toString().replace('.',this.localize('decimal'))+'\\)</p>',
            jessiebb: [-1*scale, yscale,scale*ab +scale, -1*yscale],
            jessie: 'A(0,0); B('+(scale*ab)+',0); g=[AB] nolabel; P(g,'+(scale*ab*0.5)+',0);',
            jessiecorrect: 'C('+(scale*ap)+', 0) invisible; k=[CB] nolabel; Q('+(scale*ap)+','+ (-0.2*scale) +') nolabel;',
            jessiestyles: {
                question: {
                    'lines': {
                        'strokeColor': 'blue'
                    }
                },
                questionafter: {
                    'P': {
                        'fixed': true
                    }
                },
                correct: {
                    'lines': {
                        'strokeColor': 'violet',
                        'shadow': false
                    },
                    'C': {
                        'color': 'black'
                    },
                    'Q': {
                        'face': '^',
                        'size': 6,
                        'color': 'green'
                    }
                }
            }
        }
        result.qtext = result.qtext.replace('{{{ratio}}}', ap + ':' + pb);
        result.correct = [ap, pb];
        result.getAnswer = function(board){
            var pointA = board.elementsByName['A'];
            var pointB = board.elementsByName['B'];
            var pointP = board.elementsByName['P'];
            var ap = pointA.Dist(pointP);
            var pb = pointP.Dist(pointB);
            return [ap, pb];
        }
        result.check = function(answer, correct){
            var ratio = ((answer[0] * correct[1]) / (answer[1] * correct[0]));
            var result = (0.9 < ratio && ratio < 1.1);
            return result;
        }
        return result;
    },
    angletype_image: function(){
        this.dict = {
            'angletypes': {
                'en': ['zero angle','acute angle','right angle','obtuse angle','straight angle','concave angle','reflex angle','full angle'],
                'fi': ['nollakulma','terävä kulma','suora kulma','tylppä kulma','oikokulma','kovera kulma','kupera kulma','täysi kulma'],
                'sv': ['nollvinkel','vass vinkel','rät vinkel','trubbig vinkel','rak vinkel','konvex vinkel','konkav vinkel','full vinkel'],
                'et': ['zero angle','acute angle','right angle','obtuse angle','straight angle','concave angle','reflex angle','full angle']
            },
            'qtext': {
                'en': '<p>Move the points so that the angle \\(\\alpha\\) is <strong>%1</strong>.</p>',
                'fi': '<p>Siirrä kuvion pisteitä niin, että kulma \\(\\alpha\\) on <strong>%1</strong>.</p>',
                'sv': '<p>Flytta punkterna i bilden, så att du får en <strong>%1</strong>.</p>',
                'et': '<p>Move the points so that the angle \\(\\alpha\\) is <strong>%1</strong>.</p>'
            },
            'correct': {
                'en': 'Correct!',
                'fi': 'Oikein!',
                'sv': 'Rätt svar!',
                'et': 'Correct!'
            },
            'wrong': {
                'en': 'Wrong!<br />See the model image.',
                'fi': 'Väärin!<br />Katso mallikuviota.',
                'sv': 'Fel!<br />Titta på exempelbilden bredvid.',
                'et': 'Wrong!<br />See the model image.'
            }
        }
        var angletypes = this.localize('angletypes');
        var angles = [
            [0],
            [30, 46, 69, 82],
            [90],
            [100, 122, 147, 172],
            [180],
            [30, 46, 69, 82, 90, 100, 122, 147, 172],
            [194, 230, 263, 301, 343],
            [360]
        ];
        var apoints = [[6,2],[8,3],[8,5],[8,8]];
        var cpoints = [[4,2],[2,3],[2,5],[4,8]];
        var apoint = apoints[Math.floor(Math.random()*apoints.length)];
        var cpoint = cpoints[Math.floor(Math.random()*cpoints.length)];
        var angtypeindex = Math.floor(Math.random()*angletypes.length);
        var angletype = angletypes[angtypeindex];
        var exampleangle = angles[angtypeindex][Math.floor(Math.random()*angles[angtypeindex].length)];
        var result = {
            qtype: 'image',
            qstyle: 'default',
            qtext: this.localize('qtext').replace(/%1/g, angletype),
            haspicture: true,
            feedback: '<p class="corrfeedback">'+this.localize('correct')+'</p><p class="wrongfeedback">'+this.localize('wrong')+'</p>',
            jessiebb: [0, 10, 10, 0],
            jessie: 'A('+apoint[0]+','+apoint[1]+') nolabel; B(5,5) nolabel; C('+cpoint[0]+','+cpoint[1]+') nolabel; [AB] nolabel; [BC] nolabel; alpha=<(A,B,C);',
            jessiecorrect: 'D(3,2) invisible; E(2,2) nolabel; F('+(2+Math.cos(exampleangle * Math.PI / 180))+', '+(2+Math.sin(exampleangle * Math.PI / 180))+') invisible; [DE] nolabel; [EF] nolabel; beta=<(D,E,F) nolabel;',
            jessiehidecorrect: true,
            jessiestyles: {
                question: {
                    'lines': {
                        'strokeColor': 'blue'
                    },
                    'points': {
                        'fixed': false
                    }
                },
                questionafter: {
                    'P': {
                        'fixed': true
                    }
                },
                correct: {
                    'lines': {
                        'strokeColor': 'green',
                        'shadow': false
                    },
                    'points': {
                        'fixed': true,
                        'color': 'green'
                    },
                    'angles': {
                        'radius': 0.4
                    }
                }
            },
            correct: [angtypeindex],
            getAnswer: function(board){
                return board.elementsByName['&alpha;'];
            },
            check: function(answer, correct){
                var angle = answer;
                var points = [angle.point2, angle.point1, angle.point3];
                var size = Math.round(JXG.Math.Geometry.trueAngle(points[0], points[1], points[2]));
                var iscorrect = false;
                switch (correct[0]) {
                    case 0:
                        iscorrect = (size === 0);
                        break;
                    case 1:
                        iscorrect = (0 < size && size < 90);
                        break;
                    case 2:
                        iscorrect = (size === 90);
                        break;
                    case 3:
                        iscorrect = (90 < size && size < 180);
                        break;
                    case 4:
                        iscorrect = (179 <= size && size <= 181);
                        break;
                    case 5:
                        iscorrect = (0 < size && size < 180);
                        break;
                    case 6:
                        iscorrect = (size > 180 && size < 360);
                        break;
                    case 7:
                        iscorrect = (size >= 359 || size === 0);
                        break;
                    default:
                        iscorrect = false;
                        break;
                }
                return iscorrect;
            }
        }
        return result;
    },
    triangletype_image: function(){
        this.dict = {
            'triangletypes': {
                'en': ['right', 'acute', 'obtuse', 'equilateral', 'isosceles', 'acute', 'obtuse'],
                'fi': ['suorakulmainen','teräväkulmainen','tylppäkulmainen','tasasivuinen','tasakylkinen','teräväkulmainen', 'tylppäkulmainen'],
                'sv': ['rätvinklig', 'spetsig', 'trubbig', 'liksidig', 'likbent', 'spetsig', 'trubbig'],
                'et': ['täisnurkne', 'teravnurkne', 'nürinurkne', 'võrdkülgne', 'võrdhaarne', 'teravnurkne', 'nürinurkne']
            },
            'qtext': {
                'en': '<p>Move the corner points of the triangle so that you get <strong>%1 triangle</strong>.</p>',
                'fi': '<p>Siirrä kolmion kulmapisteitä niin, että muodostuu <strong>%1 kolmio</strong>.</p>',
                'sv': '<p>Flytta på punkterna så att triangeln blir <strong>%1</strong>.</p>',
                'et': '<p>Move the corner points of the triangle so that you get <strong>%1 triangle</strong>.</p>'
            },
            'correct': {
                'en': 'Correct!',
                'fi': 'Oikein!',
                'sv': 'Rätt svar!',
                'et': 'Correct!'
            },
            'wrong': {
                'en': 'Wrong!<br />See the model image.',
                'fi': 'Väärin!<br />Katso mallikuviota.',
                'sv': 'Fel!<br />Titta på exempelbilden bredvid.',
                'et': 'Wrong!<br />See the model image.'
            }
        }
        var triangletypes = this.localize('triangletypes');
        var examples = [
            [[1,1],[2,1],[1,3]],
            [[1,1], [2.5,1], [1.5,2.5]],
            [[1.5,1], [2.5,1], [1,2.5]],
            [[1,1], [2.5,1], [1.75, 1+Math.sqrt(3)* 0.75]],
            [[1,1], [2.5,1], [1.75, 2.7]],
            [[1,1], [2.5,1], [1.5,2.5]],
            [[1.5,1], [2.5,1], [1,2.5]]
        ];
        var apoints = [[8,2],[8,3],[8,5],[8,8]];
        var bpoints = [[2,2],[3,2],[5,2],[7,2]];
        var cpoints = [[2,3],[2,5],[3,6],[6,8]];
        var apoint = apoints[Math.floor(Math.random()*apoints.length)];
        var bpoint = bpoints[Math.floor(Math.random()*bpoints.length)];
        var cpoint = cpoints[Math.floor(Math.random()*cpoints.length)];
        var triangletypeindex = Math.floor(Math.random()*triangletypes.length);
        var triangletype = triangletypes[triangletypeindex];
        var exampletriangle = examples[triangletypeindex][Math.floor(Math.random()*examples[triangletypeindex].length)];
        var result = {
            qtype: 'image',
            qstyle: 'default',
            qtext: this.localize('qtext').replace(/%1/g, triangletype),
            haspicture: true,
            feedback: '<p class="corrfeedback">'+this.localize('correct')+'</p><p class="wrongfeedback">'+this.localize('wrong')+'</p>',
            jessiebb: [0, 10, 10, 0],
            jessie: 'A('+apoint[0]+','+apoint[1]+') nolabel; B('+bpoint[0]+','+bpoint[1]+') nolabel; C('+cpoint[0]+','+cpoint[1]+') nolabel; [AB] nolabel; [BC] nolabel; [CA] nolabel; Pol[A,B,C] nolabel; alpha=<(C,A,B); beta=<(A,B,C); gamma=<(B,C,A); alpha1=<(B,A,C); beta1=<(C,B,A); gamma1=<(A,C,B);',
            //jessie: 'O(5,5) invisible; k1=k(O,3) invisible; A(k1,8,5) nolabel; B(k1,5,2) nolabel; C(k1) nolabel; [AB] nolabel; [BC] nolabel; [CA] nolabel; Pol[A,B,C] nolabel; alpha=<(C,A,B); beta=<(A,B,C); gamma=<(B,C,A);',
            jessiecorrect: ['D('+examples[triangletypeindex][0][0]+', '+examples[triangletypeindex][0][1]+') invisible;',
                            'E('+examples[triangletypeindex][1][0]+', '+examples[triangletypeindex][1][1]+') invisible;',
                            'F('+examples[triangletypeindex][2][0]+', '+examples[triangletypeindex][2][1]+') invisible;',
                            '[DE] nolabel; [EF] nolabel; [FD] nolabel;'].join(' '),
            jessiehidecorrect: true,
            jessiestyles: {
                question: {
                    'lines': {
                        'strokeColor': 'blue'
                    },
                    'points': {
                        'fixed': false,
                        'face': 'o',
                        'size': 4
                    },
                    'angles': {
                        'radius': 0.8
                    }
                },
                questionafter: {
                    'P': {
                        'fixed': true
                    }
                },
                correct: {
                    'lines': {
                        'strokeColor': 'green',
                        'shadow': false
                    },
                    'points': {
                        'fixed': true,
                        'color': 'green'
                    },
                    'angles': {
                        'radius': 0.4
                    }
                }
            },
            jessielabels: {
                question: {
                    'alpha': function(construction){
                        var A = construction['A'];
                        var B = construction['B'];
                        var C = construction['C'];
                        var board = A.board;
                        var angle = construction['alpha'];
                        return function(){
                            var alphasize = Math.round(board.angle(C,A,B) * 180 / Math.PI);
                            var betasize = Math.round(board.angle(A,B,C) * 180 / Math.PI);
                            var gammasize = 180 - alphasize - betasize;
                            if (Math.round(board.angle(C,A,B) * 180 / Math.PI) <= 0 || alphasize === 0 || betasize === 0 || gammasize === 0){
                                angle.setProperty({visible: false});
                            } else {
                                angle.setProperty({visible: true});
                            }
                            return (Math.abs(Math.round(board.angle(C,A,B) * 180 / Math.PI))) + '&deg;';
                        };
                    },
                    'alpha1': function(construction){
                        var A = construction['A'];
                        var B = construction['B'];
                        var C = construction['C'];
                        var board = A.board;
                        var angle = construction['alpha1'];
                        return function(){
                            var alphasize = Math.round(board.angle(B,A,C) * 180 / Math.PI);
                            var betasize = Math.round(board.angle(C,B,A) * 180 / Math.PI);
                            var gammasize = 180 - alphasize - betasize;
                            if (Math.round(board.angle(B,A,C) * 180 / Math.PI) <= 0 || alphasize === 0 || betasize === 0 || gammasize === 0){
                                angle.setProperty({visible: false});
                            } else {
                                angle.setProperty({visible: true});
                            }
                            return (Math.abs(Math.round(board.angle(C,A,B) * 180 / Math.PI))) + '&deg;';
                        };
                    },
                    'beta': function(construction){
                        var A = construction['A'];
                        var B = construction['B'];
                        var C = construction['C'];
                        var board = A.board;
                        var angle = construction['beta'];
                        return function(){
                            var alphasize = Math.round(board.angle(C,A,B) * 180 / Math.PI);
                            var betasize = Math.round(board.angle(A,B,C) * 180 / Math.PI);
                            var gammasize = 180 - alphasize - betasize;
                            if (Math.round(board.angle(A,B,C) * 180 / Math.PI) <= 0 || alphasize === 0 || betasize === 0 || gammasize === 0){
                                angle.setProperty({visible: false});
                            } else {
                                angle.setProperty({visible: true});
                            }
                            return (Math.abs(Math.round(board.angle(A,B,C) * 180 / Math.PI))) + '&deg;';
                        };
                    },
                    'beta1': function(construction){
                        var A = construction['A'];
                        var B = construction['B'];
                        var C = construction['C'];
                        var board = A.board;
                        var angle = construction['beta1'];
                        return function(){
                            var alphasize = Math.round(board.angle(B,A,C) * 180 / Math.PI);
                            var betasize = Math.round(board.angle(C,B,A) * 180 / Math.PI);
                            var gammasize = 180 - alphasize - betasize;
                            if (Math.round(board.angle(C,B,A) * 180 / Math.PI) <= 0 || alphasize === 0 || betasize === 0 || gammasize === 0){
                                angle.setProperty({visible: false});
                            } else {
                                angle.setProperty({visible: true});
                            }
                            return (Math.abs(Math.round(board.angle(A,B,C) * 180 / Math.PI))) + '&deg;';
                        };
                    },
                    'gamma': function(construction){
                        var A = construction['A'];
                        var B = construction['B'];
                        var C = construction['C'];
                        var board = A.board;
                        var angle = construction['gamma'];
                        return function(){
                            var alphasize = Math.round(board.angle(C,A,B) * 180 / Math.PI);
                            var betasize = Math.round(board.angle(A,B,C) * 180 / Math.PI);
                            var gammasize = 180 - alphasize - betasize;
                            if (gammasize <= 0 || gammasize > 180 || alphasize === 0 || betasize === 0 || gammasize === 0){
                                angle.setProperty({visible: false});
                            } else {
                                angle.setProperty({visible: true});
                            }
                            return Math.abs(gammasize) + '&deg;';
                        };
                    },
                    'gamma1': function(construction){
                        var A = construction['A'];
                        var B = construction['B'];
                        var C = construction['C'];
                        var board = A.board;
                        var angle = construction['gamma1'];
                        return function(){
                            var alphasize = Math.round(board.angle(B,A,C) * 180 / Math.PI);
                            var betasize = Math.round(board.angle(C,B,A) * 180 / Math.PI);
                            var gammasize = 180 - alphasize - betasize;
                            if (gammasize <= 0 || gammasize > 180 || alphasize === 0 || betasize === 0 || gammasize === 0){
                                angle.setProperty({visible: false});
                            } else {
                                angle.setProperty({visible: true});
                            }
                            return Math.abs(gammasize) + '&deg;';
                        };
                    }
                }
            },
            correct: [triangletypeindex],
            getAnswer: function(board){
                return [board.elementsByName['&alpha;'], board.elementsByName['&beta;'], board.elementsByName['&gamma;']];
            },
            check: function(answer, correct){
                var angles = answer;
                var points = [
                    [angles[0].point2, angles[0].point1, angles[0].point3],
                    [angles[1].point2, angles[1].point1, angles[1].point3],
                    [angles[2].point2, angles[2].point1, angles[2].point3]
                ];
                var sizes = [
                    Math.round(JXG.Math.Geometry.trueAngle(points[0][0], points[0][1], points[0][2])),
                    Math.round(JXG.Math.Geometry.trueAngle(points[1][0], points[1][1], points[1][2]))
                ];
                sizes.push(180-sizes[0]-sizes[1]);
                var iscorrect = false;
                switch (correct[0]) {
                    case 0:
                        iscorrect = (sizes[0] === 90 || sizes[1] === 90 || sizes[2] === 90 || sizes[0] === 270 || sizes[1] === 270 || sizes[2] === 270);
                        break;
                    case 1:
                    case 5:
                        iscorrect = (sizes[0] < 90 && sizes[1] < 90 && sizes[2] < 90);
                        break;
                    case 2:
                    case 6:
                        iscorrect = (sizes[0] > 90 || sizes[1] > 90 || sizes[2] > 90);
                        break;
                    case 3:
                        iscorrect = (sizes[0] === 60 && sizes[1] === 60 && sizes[2] === 60);
                        break;
                    case 4:
                        iscorrect = (sizes[0] === sizes[1] || sizes[1] === sizes[2] || sizes[2] === sizes[0]);
                        break;
                    default:
                        iscorrect = false;
                        break;
                }
                return iscorrect;
            }
        }
        if (result.correct > 4){
            result.jessielabels = {};
            result.jessiestyles.question.angles.visible = false;
        }
        return result;
    },
    triangle_string: [
    "    var result = {",
    "        qtype: 'shortanswer',",
    "        qtext: '<p>Mikä on kulman \\\\(\\\\beta\\\\) arvo asteina?</p>',",
    "        lblabels: ['A'],",
    "        haspicture: true",
    "    }",
    "    var correct = Math.floor(Math.random()*95)+25;",
    "    var corners = [Math.floor((180-correct) * (Math.random()*0.5+0.25))];",
    "    corners.push(180-correct-corners[0]);",
    "    var coordinates = {'A': [0,0], 'C': [8/(Math.tan(corners[0]*Math.PI/180)),8]};",
    "    coordinates['B'] = [coordinates['C'][0] + 8/(Math.tan(correct * Math.PI/180)), 0];",
    "    var maxcoord = Math.max(coordinates['A'][0], coordinates['B'][0], coordinates['C'][0]);",
    "    var mincoord = Math.min(coordinates['A'][0], coordinates['B'][0], coordinates['C'][0]);",
    "    var maxcoordy = Math.max(coordinates['A'][1], coordinates['B'][1], coordinates['C'][1]);",
    "    var mincoordy = Math.min(coordinates['A'][1], coordinates['B'][1], coordinates['C'][1]);",
    "    var scale = Math.min(8/(maxcoord - mincoord), 8/(maxcoordy - mincoordy));",
    "    var xoffset = (10 - (scale * (maxcoord-mincoord)))/2;",
    "    var yoffset = (10 - (scale * coordinates['C'][1]))/2;",
    "    coordinates = {",
    "        'A': [xoffset-scale*mincoord+ scale*coordinates['A'][0], yoffset],",
    "        'B': [xoffset-scale*mincoord+ scale*coordinates['B'][0], yoffset],",
    "        'C': [xoffset-scale*mincoord+ scale*coordinates['C'][0], yoffset+scale*coordinates['C'][1]]",
    "    };",
    "    result.jessie = [",
    "        'A('+coordinates['A'][0]+','+coordinates['A'][1]+');',",
    "        'B('+coordinates['B'][0]+','+coordinates['B'][1]+');',",
    "        'C('+coordinates['C'][0]+','+coordinates['C'][1]+');',",
    "        '[AB] nolabel; [BC] nolabel; [CA] nolabel;',",
    "        'beta=<(C,B,A);',",
    "        corners[0]+'\\u00b0=<(B,A,C);',",
    "        corners[1]+'\\u00b0=<(A,C,B);',",
    "    ].join(' ');",
    "    result.correct = [''+correct];",
    "    result.check = function(answer, corrects){",
    "        return (answer === corrects[0] || answer === (corrects + '^{\\\\circ}'));",
    "    }",
    "    return result;"].join('\n')
}

