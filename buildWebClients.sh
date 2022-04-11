#!/bin/sh

# build admin control panel
if [ ! -d "./nubo-admin" ]
then
    echo "Directory nubo-admin does not exists. Clone from git project."
    git clone https://github.com/nubosoftware/nubo-admin.git
    if [ $retVal -ne 0 ]; then
      echo "Error on git clone"
      exit $retVal
    fi
fi
cd ./nubo-admin
echo "run npm i"
npm i
echo "run npm un build"
npm run build
retVal=$?
if [ $retVal -ne 0 ]; then
    echo "Error on nubo-adin build"
    exit $retVal
fi
cd -

#build desktop client
if [ ! -d "./nubo-desktop-client" ]
then
    echo "Directory nubo-desktop-client does not exists. Clone from git project."
    git clone https://github.com/nubosoftware/nubo-desktop-client.git
    if [ $retVal -ne 0 ]; then
      echo "Error on git clone"
      exit $retVal
    fi
fi
cd ./nubo-desktop-client
npm i
npm run build
retVal=$?
if [ $retVal -ne 0 ]; then
    echo "Error on nubo-adin build"
    exit $retVal
fi
cd -

# copy build results to html
rm -rf html/admin/
cp -a ./nubo-admin/dist html/admin/

rm -rf html/desktop/
cp -a ./nubo-desktop-client/dist html/desktop/
