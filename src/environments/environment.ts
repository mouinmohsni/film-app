// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,

  firebase: {
    apiKey: 'AIzaSyDtsv0ReXfr996kUZym1s9aLuCgaGOxiQ4',
    authDomain: 'films-ionic.firebaseapp.com',
    projectId: 'films-ionic',
    appId: '1:836975628141:web:bb25ca375f0df959049464',
  },
  tmdb: {
    readAccessToken: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjZGJmNzM4Y2NkMGE2ZDY0OTg4YWU0YzljOTNhMGM4MCIsIm5iZiI6MTcwODY2MDc2Ni4yODMsInN1YiI6IjY1ZDgxODFlMWJmODc2MDE4N2JlYjlhNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.hJ2L25hvKcCh4zaGl1fApAiX_xkMism4LUNHeALjcHg',
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
