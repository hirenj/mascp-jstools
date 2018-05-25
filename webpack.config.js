const CompressionPlugin = require("compression-webpack-plugin");
const path = require('path');

module.exports = {
  devtool: 'source-map',
  entry: {
    'mascp-jstools': [ './js/gator.js' ],
  },
  output: {
    filename: '[name].js',
    path: __dirname + '/dist/js'
  },
  plugins: [
    new CompressionPlugin()
  ],
  devServer: {
   contentBase: path.join(__dirname, "/"),
   compress: true,
   port: 3000,
 },
  module: {
    rules: [{
      test: /\.js$/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            ['env', {
              modules: false,
              useBuiltIns: true,
              targets: {
                browsers: [
                  'Chrome >= 60',
                  'Safari >= 10.1',
                  'iOS >= 10.3',
                  'Firefox >= 54',
                  'Edge >= 15',
                ],
              },
            }],
          ],
        },
      },
    }],
  },
};