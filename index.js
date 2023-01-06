const fs = require('fs');
const path = require('path');
const findNodeModules = require('find-node-modules');
const {printLog, processTypeEnum} = require('@tarojs/helper');

const TAG = require('./package.json').name;

const COMMON_MODULAR_TEXT = '';
const PACKAGE_PREFIX = 'weapp-modular';
const AUTO_GENERATION_TEXT = `系统自动生成，请勿删除【${TAG}】`

/**
 * 获取已安装的标准版模块
 */
function getInstalledModules(appPath) {
    let packagePath = path.resolve(appPath, './package.json');
    if (!fs.existsSync(packagePath)) {
        printLog(processTypeEnum.ERROR, `package.json 文件不存在`, packagePath);
    }
    const dependencies = JSON.parse(fs.readFileSync(packagePath, {encoding: 'utf-8'})).dependencies;

    const ignorePackages = [
        `${PACKAGE_PREFIX}-plugin`,
        `${PACKAGE_PREFIX}-shared`,
    ];
    const modularDependencies = Object.keys(dependencies).filter(dependency => {
        if (!dependency.startsWith('weapp-modular')) {
            return false;
        }
        if (ignorePackages.includes(dependency)) {
            return false;
        }
        return true;
    });
    return modularDependencies.map(dependency => {
        const nodeModulePaths = findNodeModules({ cwd: './' + dependency, relative: false })
        for (const nodeModulePath of nodeModulePaths) {
            let modulePath = nodeModulePath + '/' + dependency;
            if (fs.existsSync(modulePath)) {
                const moduleName = modulePath.split(PACKAGE_PREFIX + '-').reverse()[0];
                const packageName = `sub-pkg-${moduleName}`;
                let pagesPath = `${modulePath}/pages.json`;
                if (!fs.existsSync(pagesPath)) {
                    printLog(processTypeEnum.ERROR, `pages.json 文件不存在`, pagesPath);
                }
                console.log(`${TAG}: 发现模块`, packageName)
                return {
                    moduleName,
                    modulePath,
                    packageName,
                    pages: require(pagesPath)
                };
            }
        }
    }).filter(item => !!item);
}

/**
 * 软链接模块代码至项目中
 */
function symlinkModular({appPath, installedModules}) {
    for (const installedModule of installedModules) {
        const modulePath = `${appPath}/src/sub-pkg-${installedModule.moduleName}`;
        if (fs.existsSync(modulePath)) {
            fs.unlinkSync(modulePath);
        }
        fs.symlinkSync(installedModule.modulePath, modulePath);
    }
}

/**
 * gitignore中添加已安装的模块，避免代码被提交
 */
function updateGitIgnore({appPath, installedModules}) {
    const gitignorePath = `${appPath}/.gitignore`;
    if (!fs.existsSync(gitignorePath)) {
        printLog(processTypeEnum.ERROR, `.gitignore 文件不存在`, gitignorePath);
    }
    const gitignore = fs.readFileSync(gitignorePath, {encoding: 'utf-8'});
    let newContent = gitignore;
    const annotation = `# ${COMMON_MODULAR_TEXT} ${AUTO_GENERATION_TEXT}`;
    if (!gitignore.includes(annotation)) {
        newContent += `\n${annotation}`;
    }
    for (const installedModule of installedModules) {
        if (!gitignore.includes(installedModule.packageName)) {
            newContent += `\n${installedModule.packageName}`;
        }
    }
    if (newContent !== gitignore) {
        fs.writeFileSync(gitignorePath, newContent, {encoding: 'utf-8'});
    }
}

/**
 * 修改app.config，引入已安装的模块
 * 考虑一种比较优雅的方式，尽量对用户是无感知的
 */
function updateAppConfig({appPath, installedModules, appConfig}) {
    let subPackages = appConfig.subPackages || appConfig.subpackages;
    if (!subPackages) {
        subPackages = [];
        appConfig.subPackages = subPackages;
    }
    for (const installedModule of installedModules) {
        if (!subPackages.some(item => item.name === installedModule.moduleName)) {
            subPackages.push({
                name: installedModule.moduleName,
                root: installedModule.packageName,
                pages: installedModule.pages,
            })
        }
    }
}

/**
 * 修改config/index.js，引入compile的include属性
 * 解决实际引入时Taro对node_modules不编译导致的loader报错问题
 */
function updateConfig({opts,installedModules}){
    let includePath = [
        path.resolve(__dirname, '..', 'weapp-shared/'),
    ]
    for (const installedModule of installedModules) {
        includePath.push(installedModule.modulePath)
        opts.compile = {
            include: includePath
        }
    }
}

let buildFirst = true;

module.exports = (ctx) => {
    let appPath = ctx.appPath;
    const installedModules = getInstalledModules(appPath);

    const taroVersion = ctx.helper.getInstalledNpmPkgVersion('@tarojs/taro', appPath);

    ctx.onBuildStart(() => {
        // 只触发一次即可，多次触发会存在问题
        if (!buildFirst) {
            return;
        }
        buildFirst = false;

        symlinkModular({appPath, installedModules})
        updateGitIgnore({appPath, installedModules})
    })
    ctx.modifyRunnerOpts(({opts}) => {
        updateConfig({opts,installedModules})
    })
    ctx.modifyMiniConfigs(({configMap} ) => {
        updateAppConfig({appPath, installedModules, appConfig: configMap['app.config'].content})
    })
    ctx.modifyWebpackChain(({ chain }) => {
        const currentMiniPluginFixPath = path.resolve(__dirname, `./MiniPluginFix/index-${taroVersion}.js`);
        const defaultMiniPluginFixPath = path.resolve(__dirname, `./MiniPluginFix/index.js`);

        if (fs.existsSync(currentMiniPluginFixPath)) {
            chain.plugins.store.get('miniPlugin').store.set('plugin', require(currentMiniPluginFixPath).default);
        } else {
            // 默认为 @tarojs/taro 3.5.4
            chain.plugins.store.get('miniPlugin').store.set('plugin', require(defaultMiniPluginFixPath).default);
        }
    })
}
