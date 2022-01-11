
const ts_fetch = require("ts-fetch");
const fs = require('fs');

(async function () {

  const http = new ts_fetch.http();

  const data = await http.get("https://storage.googleapis.com/audiobook_edrlab/feed.json", {}, async (res) => {

    res.data = await res.response?.json();

    return res;
  });

  console.log(data);
  fs.writeFileSync("/tmp/feed_data.json", JSON.stringify(data));

})()


