import jsdom from 'jsdom';
import { storiesKey } from './constants';

// jsdom doesn't support Web Workers yet.
// We use workerMock to allow the user's preview.js to interact with the Worker API.
const workerMock = `
    function MockWorker(path) {
      var api = this;

      function addEventListener() {}
      function removeEventListener() {}
      function postMessage() {}
      function terminate() {}

      api.postMessage = postMessage;
      api.addEventListener = addEventListener;
      api.removeEventListener = removeEventListener;
      api.terminate = terminate;

      return api;
    }
    window.Worker = MockWorker;
`;

// jsdom doesn't support localStorage yet.
// We use localStorageMock to allow the user's preview.js to interact with localStorage.
const localStorageMock = `
    var localStorageMock = (function() {
      var store = {};
      return {
        getItem: function(key) {
          return store[key];
        },
        setItem: function(key, value) {
          store[key] = value.toString();
        },
        clear: function() {
          store = {};
        }
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    `;

// jsdom doesn't support matchMedia yet.
const matchMediaMock = `
    window.matchMedia = window.matchMedia || (() => {
      return {
        matches: false,
        addListener: () => {},
        removeListener: () => {},
      };
    });
    `;

function getStoriesFromDom(previewJavascriptCode, options) {
  return new Promise((resolve, reject) => {
    const jsDomConfig = {
      html: '',
      url: 'https://example.com/iframe.js?selectedKind=none&selectedStory=none',
      src: [workerMock, localStorageMock, matchMediaMock, previewJavascriptCode],
      done: (err, window) => {
        if (err) return reject(err.response.body);

        // Check if the window has stories every 100ms for up to 10 seconds
        // This allows 10 seconds for any async tasks (like fetch)
        // Usually stories will be found on the first loop.
        var checkStories = function(timesCalled) {
          if (!window || (timesCalled >= 100 && !window[storiesKey])) {
            // Attempted 100 times, give up.
            const message =
              'Storybook object not found on window. ' +
              "Check your call to serializeStories in your Storybook's config.js.";
            reject(new Error(message));
          }
          if (window[storiesKey]) {
            // Found the stories, return them.
            resolve(window[storiesKey]);
          } else {
            // Stories not found yet but no error, try again 100ms from now
            setTimeout(() => {
              if (timesCalled < 100) {
                checkStories(timesCalled + 1);
              }
            }, 100);
          }
        };
        checkStories(0);
      },
    };
    if (options.debug) {
      jsDomConfig.virtualConsole = jsdom.createVirtualConsole().sendTo(console);
    }
    jsdom.env(jsDomConfig);
  });
}

export default async function getStories(storybookCode, options = {}) {
  if (!storybookCode || storybookCode === '') throw new Error('Storybook code was not received.');
  const stories = await getStoriesFromDom(storybookCode, options);
  return stories;
}
