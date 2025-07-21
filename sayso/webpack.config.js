const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require('webpack');

const isEnvProduction = process.env.NODE_ENV === "production";

module.exports = {
    mode: isEnvProduction ? "production" : "development",
    devtool: "source-map",
    entry: {
        index: "./src/ui/index.jsx",
        code: "./src/sandbox/code.js"
    },
    experiments: {
        outputModule: true
    },
    output: {
        pathinfo: !isEnvProduction,
        path: path.resolve(__dirname, "dist"),
        module: true,
        filename: "[name].js"
    },
    externalsType: "module",
    externalsPresets: { web: true },
    externals: {
        "add-on-sdk-document-sandbox": "add-on-sdk-document-sandbox",
        "express-document-sdk": "express-document-sdk"
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "src/index.html",
            scriptLoading: "module",
            excludeChunks: ["code"]
        }),
        new CopyWebpackPlugin({
            patterns: [{ from: "src/*.json", to: "[name][ext]" }]
        }),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            'process.env.CHROMATIC': JSON.stringify(false)
        })
    ],
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                use: ["babel-loader"],
                exclude: /node_modules/
            },
            {
                test: /(\.css)$/,
                use: ["style-loader", "css-loader"]
            }
        ]
    },
    resolve: {
        extensions: [".jsx", ".js", ".css"]
    },
    devServer: {
        port: 5241,
        server: {
            type: 'https',
            options: {
                // You can add cert/key here if needed, or leave empty for self-signed
            }
        },
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        hot: false,
        open: false
    }
};
