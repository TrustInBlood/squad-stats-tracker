module.exports = {
    servers: [
      {
        id: 'server1',
        url: 'ws://xxx.xxx.xxx.xxx:xxxx',
        token: 'SuperSecretPassword',
        logStats: true  // Set to false to disable stats logging for this server
      }
      // Add more servers as needed:
      // {
      //   id: 'server2',
      //   url: 'ws://yyy.yyy.yyy.yyy:yyyy',
      //   token: 'AnotherSecretPassword',
      //   logStats: true
      // }
    ]
  }; 