export const BETRADAR_WIDGET_LOADER_ID = "44424242424";
export const BETRADAR_DEMO_MATCH_ID = "70585628";

export function buildBetradarLmtHtml(matchId) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #07111F;
        color: #F4F8FF;
        font-family: Roboto, Arial, sans-serif;
      }
      .widgets {
        width: 100%;
        min-height: 640px;
      }
      .sr-widget {
        width: 100%;
        min-height: 640px;
        border: 0;
      }
    </style>
  </head>
  <body>
    <script>
      (function(a,b,c,d,e,f,g,h,i){
        a[e]||(i=a[e]=function(){(a[e].q=a[e].q||[]).push(arguments)},i.l=1*new Date,i.o=f,
        g=b.createElement(c),h=b.getElementsByTagName(c)[0],g.async=1,g.src=d,g.setAttribute("n",e),h.parentNode.insertBefore(g,h))
      })(window,document,"script","https://widgets.sir.sportradar.com/${BETRADAR_WIDGET_LOADER_ID}/widgetloader","SIR",{
        theme: true,
        language: "br"
      });
      SIR("addWidget",".sr-widget-1","match.lmtPlus",{
        layout:"topdown",
        scoreboardLargeJerseys:true,
        matchId:${JSON.stringify(String(matchId))}
      });
    </script>
    <div class="widgets">
      <div class="sr-widget sr-widget-1"></div>
    </div>
  </body>
</html>`;
}
