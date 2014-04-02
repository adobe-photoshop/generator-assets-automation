#! /bin/bash

if [ -z "$1" ]; then
    echo "specify a destination folder"
else
    pushd `pwd`
    mkdir -p $1/Plug-ins/Generator/generator-assets-automation
    git archive -o $1/Plug-ins/Generator/generator-assets-automation/generator-assets-automation.tar HEAD
    cd $1/Plug-ins/Generator/generator-assets-automation
    tar -xvf generator-assets-automation.tar
    rm generator-assets-automation.tar
    npm install --production
    cd $1
    zip -r generator-assets-automation-`date "+%Y-%m-%d-%H-%M-%S"`.zip Plug-ins
    rm -rf Plug-ins
    popd
fi
