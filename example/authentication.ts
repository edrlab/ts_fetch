import {http, AuthenticationStorage} from 'ts-fetch';

const tokenStorage = new AuthenticationStorage();

tokenStorage.setAuthenticationToken({
  accessToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwic3ViIjoxLCJpYXQiOjE2NDI0MjY0OTIsImV4cCI6MTY0MjQyNjU1Mn0.8aLkbdKsOnlATkta1jr_pDxvUNzFg98WuHcC_oF4i6o',
  authenticationUrl:
    'https://opds-auth-test-server-aplqpqv3wa-ey.a.run.app/implicit',
});

const _http = new http(undefined, tokenStorage);

_http
  .get(
    'https://opds-auth-test-server-aplqpqv3wa-ey.a.run.app/implicit',
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
