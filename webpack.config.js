module.exports = {
  devServer: {
    allowedHosts: 'all',
  },
  resolve: {
    fallback: {
      "https": false,
      "http": false,
      "stream": false,
      "zlib": false,
      "util": false,
      "url": false
    }
  }
};
