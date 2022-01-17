import {http} from 'ts-fetch';

const _http = new http();

_http
  .get(
    'https://storage.googleapis.com/audiobook_edrlab/feed.json',
    {},
    async res => {
      console.log('request callback');

      res.data = await res.response?.json();

      return res;
    }
  )
  .then(async data => {
    console.log(data);
  });
