define([
  'core/js/adapt'
], function(Adapt) {

  const TimedSubmitAll = Backbone.View.extend({

    className: 'timed-submit-all',

    events: {
      'click .js-btn-action': 'onTimedSubmitAllButtonClicked'
    },

    initialize: function() {
      this.model.get('_articleView').$el.addClass('no-submit-buttons');

      this.listenTo(Adapt, {
        'componentView:postRender': this.onComponentViewRendered,
        remove: () => {
          this.removeEventListeners();
          this.remove();
        }
      });

      _.bindAll(this, 'onInteraction', '_onInteractionDelegate');

      this.render();

      window.scormSetRemainingTime = (seconds) => {

        // disable debug timing and prevent additional calls
        let remainingTime = $(".autoSubmitTimer");
        if (window.remainingTimeIsSet) {
          if (remainingTime)
            remainingTime.show();
          return;
        }
        
        window.remainingTimeIsSet = true;
        
        var intervalId = setInterval(() => {
          seconds--;
          this.showRemainingTime(seconds);
        }, 1000);

        // Debug timeout: submit after 10 seconds
        let timeout = setTimeout(() => {
          clearInterval(intervalId); // Clear periodic remaining time update
          this.autoSubmit();
        }, seconds * 1000);

        
        if (remainingTime)
          remainingTime.show();
      }

      // Set debug time if no time was set externally within 10 seconds
      let timeoutDebug = setTimeout(() => {
        let debugTimeInSeconds = this.model.get('_timerAmount');
        // console.log(debugTimeInSeconds);

        if (!window.remainingTimeIsSet) {
          console.log('Start debug timing');
          window.scormSetRemainingTime(debugTimeInSeconds);
        }
      }, 10 * 1000);


      // Notify init complete
      if (window.opener) {
        window.opener.postMessage('scormTimedSubmitAllInitComplete', '*');
      }
      if (window.parent) {
        window.parent.postMessage('scormTimedSubmitAllInitComplete', '*');
      }

    },

    showRemainingTime: function(seconds) {
      d = Number(seconds);
      var h = Math.floor(d / 3600);
      var m = Math.floor(d % 3600 / 60);
      var s = Math.floor(d % 3600 % 60);
  
      var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
      var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
      var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
      
      let remainingTime = $(".autoSubmitRemaining");
      remainingTime.text('Remaining time: ' + hDisplay + mDisplay + sDisplay);
    },

    autoSubmit: function() {
      // check if was already submitted
      let already_submitted = this.model.get('_isSubmitted');
      if (already_submitted) return;

      // ON TIME UP ANSWER THE UN SELECTED QUESTIONS AS INCOMPLETE
      var currentModel = Adapt.findById(Adapt.location._currentId);
      console.log('currentModel');
      console.log(currentModel);

      let components = currentModel.findDescendantModels('components');
      console.log('components');
      console.log(components);

      var incomplete = _.where(components, function(m) {
        return m.get('_isInteractionComplete') === false;
      });
      console.log(incomplete);

      _.each(incomplete, function(component) {

        var compeachid = component.get("_id");
        // console.log(compeachid);

        let comp = $("." + compeachid);
        console.log(comp);

        if (comp.hasClass("mcq") && comp.hasClass("is-question")) {
          console.log('comp.hasClass("mcq") && comp.hasClass("is-question")');

          let answers = $("." + compeachid + " .mcq-item__label");
          let any_selected = answers.hasClass("is-selected");

          if (!any_selected) {
            // No selection was made
            if (component.get('_isQuestionType')) {
              
              // console.log('_isQuestionType');

              component.set("_isCorrect", false);
              component.set("_isSubmitted", true);
              component.set("_score", 0);
              component.set("_attemptsLeft", 0);
            }

            component.set("_isComplete", true);
            component.set(currentModel.has('_isInteractionsComplete') ? '_isInteractionsComplete' : '_isInteractionComplete', true);
          }
          else {
            // Submit question if any selection was made
            comp.addClass("markthequestion");
            //$("." + compeachid + ".mcq-component").addClass("markthequestion");

            let button = $("." + compeachid + ".mcq.markthequestion .btn__action");
            button.trigger("click");
					  // $("." + compeachid + ".mcq-component.markthequestion .buttons-action").trigger("click");

          }

        }
      });

      // Finish submit
      this.enableTimedSubmitAllButton(false);
      this.model.set('_isSubmitted', true);
      Adapt.trigger('timedSubmitAll:submitted', this.model.get('_componentViews'));

      let submitAllButtonContainer = $(".btn__response-container");
      submitAllButtonContainer.hide();

      let autosSubmitDonePanel = $(".autosubmit_done_panel");
      autosSubmitDonePanel.show();

      let remainingTime = $(".autoSubmitTimer");
      remainingTime.hide();

      // Scroll to end of page
      window.setTimeout(function(){
        $("html, body").animate({ scrollTop: $(document).height() }, 500);
      }, 1000);

      // Notify submit complete
      if (window.opener) {
        window.opener.postMessage('scormTimedSubmitAllSubmitted', '*');
      }
      if (window.parent) {
        window.parent.postMessage('scormTimedSubmitAllSubmitted', '*');
      }
    },

    render: function() {
      const submitButtonLabels = Adapt.course.get('_buttons')._submit;

      this.$el.html(Handlebars.templates.timedSubmitAll({
        buttonText: submitButtonLabels.buttonText,
        ariaLabel: submitButtonLabels.ariaLabel
      }));

      const $containerDiv = this.getContainerDiv(this.model.get('_articleView').$el, this.model.get('_insertAfterBlock'));
      $containerDiv.after(this.$el);

      return this;
    },

    /**
    * Returns a reference to the `<div>` we're going to append our view to.
    * @param {jQuery} $article JQuery reference to the article we're attached to
    * @param {string} [blockId] The id of the block to append our view to. Must be in the article we're attached to...
    * @return {jQuery}
    */
    getContainerDiv: function($article, blockId) {
      if (blockId) {
        const $div = $article.find('.' + blockId);
        if ($div.length > 0) return $div;
      }

      return $article.find('.block').last();
    },

    enableTimedSubmitAllButton: function(enable) {
      const $timedSubmitAllButton = this.$el.find('.js-btn-action');
      if (enable) {
        $timedSubmitAllButton.removeClass('is-disabled').attr('aria-disabled', false);
        return;
      }

      $timedSubmitAllButton.addClass('is-disabled').attr('aria-disabled', true);
    },

    /**
    * Checks all the questions in the article to see if they're all ready to be submitted or not
    * @return {boolean}
    */
    canSubmit: function() {
      const allAnswered = this.model.get('_componentViews').every(component => component.model.get('_isEnabled') && component.canSubmit());
      return allAnswered;
    },

    removeEventListeners: function() {
      this.model.get('_componentViews').forEach(view => {
        if (view.model.get('_component') === 'textinput') {
          view.$el.find('input').off('change.timedSubmitAll');
          return;
        }
        view.$el.off('click.timedSubmitAll');
      });
    },

    /**
    * Checks the view to see if it is:
    * a) a question component
    * b) a child of the article we're attached to
    * And, if it is, add it to the list and listen out for the learner interacting with it
    * @param {Backbone.View} view
    */
    onComponentViewRendered: function(view) {
      if (!view.$el.hasClass('is-question')) return;

      const parentArticleId = view.model.findAncestor('articles').get('_id');
      const timedSubmitAllArticleId = this.model.get('_articleView').model.get('_id');
      if (parentArticleId !== timedSubmitAllArticleId) return;

      this.model.get('_componentViews').push(view);

      if (view.model.get('_component') === 'textinput') {
        view.$el.find('input').on('change.timedSubmitAll', this.onInteraction);
        return;
      }

      view.$el.on('click.timedSubmitAll', this.onInteraction);
    },

    onInteraction: function() {
      // need to wait until current call stack's done in FF
      _.defer(this._onInteractionDelegate);
    },

    _onInteractionDelegate: function() {
      if (this.model.get('_isSubmitted')) return;

      this.enableTimedSubmitAllButton(this.canSubmit());
    },

    onTimedSubmitAllButtonClicked: function() {
      this.model.get('_componentViews').forEach(view => view.$el.find('.js-btn-action').trigger('click'));

      this.enableTimedSubmitAllButton(false);

      this.model.set('_isSubmitted', true);

      Adapt.trigger('timedSubmitAll:submitted', this.model.get('_componentViews'));

      // Notify submit complete
      if (window.opener) {
        window.opener.postMessage('scormTimedSubmitAllSubmitted', '*');
      }
      if (window.parent) {
        window.parent.postMessage('scormTimedSubmitAllSubmitted', '*');
      }
    }
  });

  Adapt.on('articleView:postRender', view => {
    const saData = view.model.get('_timedSubmitAll');
    if (!saData || !saData._isEnabled) return;

    const model = new Backbone.Model({
      ...saData,
      _isSubmitted: false,
      _articleView: view,
      _componentViews: []
    });

    new TimedSubmitAll({ model });
  });
});
