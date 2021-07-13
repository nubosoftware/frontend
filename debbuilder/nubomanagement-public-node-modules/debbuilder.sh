BUILD_ROOT=${BUILD_ROOT:="$PROJ_PATH/debbuild"}/nubomanagement-public-node-modules
Version=${Version:="1.2.0.0"}

echo "NUBO_PROJ_PATH $NUBO_PROJ_PATH"
echo "BUILD_ROOT $BUILD_ROOT"

rm -rf $BUILD_ROOT
mkdir -p $BUILD_ROOT/opt/nubomanagement-public

install -m 644 $NUBO_PROJ_PATH/nubomanagement-public/package.json $BUILD_ROOT/opt/nubomanagement-public/package.json

cd $BUILD_ROOT/opt/nubomanagement-public/
npm install --only=prod || exit 1
rm package.json
cd -


rsync -r $PROJ_PATH/debbuilder/nubomanagement-public-node-modules/DEBIAN/ $BUILD_ROOT/DEBIAN/
sed "s/%Version%/$Version/g" -i $BUILD_ROOT/DEBIAN/control

