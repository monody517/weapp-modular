const MiniPlugin = require('@tarojs/mini-runner/dist/plugins/MiniPlugin.js').default;

class TaroMiniPlugin extends MiniPlugin {
    constructor(options = {}) {
        super(options);
    }

    /**
     * 分析 app 入口文件，搜集页面、组件信息，
     * 往 this.dependencies 中添加资源模块
     */
    run(compiler) {
        this.appConfig = this.getAppConfig();
        this.modifyMiniConfigs();
        this.getPages();
        this.getPagesConfig();
        this.getDarkMode();
        this.getConfigFiles(compiler);
        this.addEntries();
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
