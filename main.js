// build-in
const path = require('path');
const fs = require('fs');

// package program
const packageJson = require('./package.json');
const ua = {headers:{'user-agent':`winTdlibBuilder/${packageJson.version}`}};
console.log(`\n=== NODEJS TDLIB BUILDER FOR WINDOWS ${packageJson.version} ===\n`);

// npm
const fse = require('fs-extra')
const shlp = require('sei-helper');
const got = require('got').extend(ua);
const AdmZip = require('adm-zip');
const yaml = require('yaml');

// version
const vers = yaml.parse(fs.readFileSync(`${__dirname}/versions.yaml`, `utf8`));

// paths
let bindir   = `${__dirname}/bin/`;
let builddir = `${__dirname}/builds/`;
let sysbit   = ``;

// program
(async function(){
    if(!fs.existsSync(bindir)){
        fs.mkdirSync(bindir);
    }
    await setBits();
}());

async function setBits(){
    sysbit = await shlp.ask({
        type: 'list',
        name: 'sysbit',
        message: 'Select build type',
        default: 'x64',
        choices: [
            { value: 'x86', name: `Windows x86` },
            { value: 'x64', name: `Windows x64` }
        ]
    });
    process.chdir(bindir);
    await getCmake();
    await getGperf();
    await getTdlibSrc();
    // await getTools();
    await doBuild();
}

async function getCmake(){
    let cmakeBits        = sysbit != `x86` ? `win64-x64` : `win32-x86`;
    let cmakeFln         = `cmake-${vers.cmake}-${cmakeBits}`
    let cmakeZipUrl      = `https://github.com/Kitware/CMake/releases/download/v${vers.cmake}/${cmakeFln}.zip`;
    if(!fs.existsSync(`${cmakeFln}.zip`)){
        console.log('\nDownloading CMake...');
        await downloadFile(cmakeZipUrl, `${cmakeFln}.zip`);
    }
    if(fs.existsSync(cmakeFln)){
        // await fse.removeSync(cmakeFln);
    }
    else{
        console.log(`\nExtracting CMake...`)
        let srczip = new AdmZip(`${cmakeFln}.zip`);
        srczip.extractAllTo('', true);
        console.log(`DONE!`);
    }
    process.env.Path += `;` + path.join(bindir, cmakeFln, `/bin/`);
}

async function getGperf(){
    let gperfFln    = `gperf-${vers.gperf}-bin`;
    let gperfZipUrl = `https://downloads.sourceforge.net/project/gnuwin32/gperf/${vers.gperf}/${gperfFln}.zip`;
    if(!fs.existsSync(`${gperfFln}.zip`)){
        console.log('\nDownloading gperf....');
        await downloadFile(gperfZipUrl, `${gperfFln}.zip`);
    }
    if(fs.existsSync(gperfFln)){
        // await fse.removeSync(gperfFln);
    }
    else{
        console.log(`\nExtracting gpref...`)
        let srczip = new AdmZip(`${gperfFln}.zip`);
        srczip.extractAllTo(gperfFln, true);
        console.log(`DONE!`);
    }
    process.env.Path += `;` + path.join(bindir, gperfFln, `/bin/`);
}

async function getTdlibSrc(){
    let tdlibFln    = `td-${vers.tdlib}`;
    let tdlibZipUrl = `https://github.com/tdlib/td/archive/v${vers.tdlib}.zip`;
    if(!fs.existsSync(`${tdlibFln}.zip`)){
        console.log('\nDownloading TDLib Source...');
        await downloadFile(tdlibZipUrl, `${tdlibFln}.zip`);
    }
    if(fs.existsSync(tdlibFln)){
        // await fse.removeSync(tdlibFln);
    }
    else{
        console.log(`\nExtracting Tdlib source...`)
        let srczip = new AdmZip(`${tdlibFln}.zip`);
        srczip.extractAllTo('', true);
        console.log(`DONE!`);
    }
}

async function getTools(){
    let gitType        = sysbit != `x86` ? `64-bit` : `32-bit`;
    let gitFln         = `PortableGit-${vers.git}-${gitType}`;
    let gitZipUrl      = `https://github.com/git-for-windows/git/releases/download/v${vers.git}.windows.1/${gitFln}.7z.exe`;
    if(!fs.existsSync(`${gitFln}.7z.exe`)){
        console.log('\nDownloading Git...');
        await downloadFile(gitZipUrl, `${gitFln}.7z.exe`);
    }
}

async function doBuild(){
    let vcpkgShortVer = vers.vcpkg;
    if(vcpkgShortVer.length == 40){
        vcpkgShortVer = vcpkgShortVer.slice(0, 7);
    }
    if(!fs.existsSync(`vcpkg-${vcpkgShortVer}.zip`)){
        console.log(`\nDownloading vcpkg [REV: ${vcpkgShortVer}]....`);
        await downloadFile(`https://github.com/microsoft/vcpkg/archive/${vers.vcpkg}.zip`, `vcpkg-${vcpkgShortVer}.zip`);
    }
    if(!fs.existsSync(`vcpkg-${vcpkgShortVer}`)){
        console.log(`\nExtracting vcpkg...`)
        let srczip = new AdmZip(`vcpkg-${vcpkgShortVer}.zip`);
        srczip.extractAllTo('', true);
        if(fs.existsSync(`vcpkg-${vers.vcpkg}`) && !fs.existsSync(`vcpkg-${vcpkgShortVer}`)){
            fs.renameSync(`vcpkg-${vers.vcpkg}`, `vcpkg-${vcpkgShortVer}`);
        }
        console.log(`DONE!`);
    }
    process.chdir(`vcpkg-${vcpkgShortVer}`);
    shlp.exec(`bootstrap-vcpkg`,`bootstrap-vcpkg`,``);
    shlp.exec(`vcpkg`,`vcpkg`,`upgrade`);
    shlp.exec(`vcpkg`,`vcpkg`,`install openssl:${sysbit}-windows zlib:${sysbit}-windows`);
    process.chdir(`..`);
    process.chdir(`td-${vers.tdlib}`);
    if(fs.existsSync(`build`)){
        await fse.removeSync(`build`);
    }
    fs.mkdirSync(`build`);
    process.chdir(`build`);
    let cmakeCmd = `-DCMAKE_INSTALL_PREFIX:PATH=../tdlib -DCMAKE_TOOLCHAIN_FILE:FILEPATH=../../vcpkg-${vcpkgShortVer}/scripts/buildsystems/vcpkg.cmake ..`;
    shlp.exec(`cmake`,`cmake`, (sysbit != `x86`?`-A x64 `:``) + cmakeCmd);
    shlp.exec(`cmake`,`cmake`, `--build . --target install --config Release`);
    if(!fs.existsSync(builddir)){
        fs.mkdirSync(builddir);
    }
    process.chdir(builddir);
    let outBuildFolder = `td-${vers.tdlib}-` + (sysbit != `x86` ? `win64-x64` : `win32-x86`)
    if(!fs.existsSync(outBuildFolder)){
        fs.mkdirSync(outBuildFolder);
    }
    else{
        fse.removeSync(outBuildFolder);
        fs.mkdirSync(outBuildFolder);
    }
    process.chdir(outBuildFolder);
    console.log(`Copying dlls to td-${vers.tdlib}-${sysbit}-build folder...`);
    fs.copyFileSync(`${bindir}/vcpkg/installed/${sysbit}-windows/bin/libeay32.dll`, `libeay32.dll`);
    fs.copyFileSync(`${bindir}/vcpkg/installed/${sysbit}-windows/bin/ssleay32.dll`, `ssleay32.dll`);
    fs.copyFileSync(`${bindir}/vcpkg/installed/${sysbit}-windows/bin/zlib1.dll`, `zlib1.dll`);
    fs.copyFileSync(`${bindir}/td-${vers.tdlib}/tdlib/bin/tdjson.dll`, `tdjson.dll`);
    console.log(`Done!`);
}

function downloadFile(zipUrl, zipFilaname) {
    return new Promise((resolve, reject) => {
        let fls = fs.createWriteStream(zipFilaname);
        fls.on('close', function(){
            resolve();
        });
        let progress = createProgressData();
        got.stream(zipUrl).on('response', function(data){
            progress.dataTotal = parseInt(data.headers['content-length'], 10);
        })
        .on('data', function(chunk){
            fls.write(chunk);
            progress.currentTime      = Date.now();
            progress.dataTransferred += chunk.length;
            if(progress.prevTime < 1 || progress.currentTime - progress.prevTime > 999){
                progress = Object.assign(progress,shlp.uplStatus2Speed(
                    progress.currentTime, progress.dataTransferred,
                    progress.prevTime, progress.prevBytes,
                ));
                shlp.uplStatus2(
                    '[DOWNLOADING]',
                    progress.timeStart,   progress.dataTotal,
                    progress.currentTime, progress.dataTransferred,
                    progress.sendSpeed,
                );
            }
        })
        .on('error', function(){
            fls.end();
            reject();
        })
        .on('end', function(){
            fls.end();
        });
    })
}

function createProgressData(){
    return {
        timeStart      : Date.now(),
        dataTotal      : 1,
        currentTime    : 0,
        dataTransferred: 0,
        prevTime       : 0,
    };
}