const MiniPlugin = require('@tarojs/webpack5-runner/dist/plugins/MiniPlugin');

class TaroMiniPlugin extends MiniPlugin.default {
    constructor(options = {}) {
        super(options);
    }

    /**
     * 分析 app 入口文件，搜集页面、组件信息，
     * 往 this.dependencies 中添加资源模块
     */
    run(compiler) {
        if (this.options.isBuildPlugin) {
            this.getPluginFiles();
            this.getConfigFiles(compiler);
        }
        else {
            this.appConfig = this.getAppConfig();
            this.modifyMiniConfigs();
            this.getPages();
            this.getPagesConfig();
            this.getDarkMode();
            this.getConfigFiles(compiler);
            this.addEntries();
        }
    }

    modifyMiniConfigs() {
        const { modifyMiniConfigs } = this.options;
        if (typeof modifyMiniConfigs === 'function') {
            modifyMiniConfigs(this.filesConfig);
        }
    }
}
exports.default = TaroMiniPlugin;
//# sourceMappingURL=MiniPlugin.js.map
