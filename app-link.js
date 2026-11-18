// Reads what Supabase put after the "#" of the link (tokens or an error) and then clears it from
// the address bar, so the tokens do not stay in the browser history.
(function () {
  var fragment = window.location.hash;
  var params = new URLSearchParams(fragment.slice(1));
  window.UngoonLink = {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    hasError: Boolean(params.get("error") || params.get("error_code")),
    isPhone: /Android|iPhone|iPad/i.test(navigator.userAgent),
    // The same answer, sent to the app through its own scheme.
    appUrl: function (path) {
      return "ungoon://" + path + fragment;
    },
    openApp: function (path) {
      window.location.href = "ungoon://" + path + fragment;
    },
  };
  history.replaceState(null, "", window.location.pathname + window.location.search);
})();
