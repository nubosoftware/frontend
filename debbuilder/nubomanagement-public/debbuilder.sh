BUILD_ROOT=${BUILD_ROOT:="$PROJ_PATH/debbuild"}/nubomanagement-public
Version=${Version:="1.2.0.0"}

echo "NUBO_PROJ_PATH $NUBO_PROJ_PATH"
echo "BUILD_ROOT $BUILD_ROOT"

rm -rf $BUILD_ROOT
mkdir -p $BUILD_ROOT

rsync -r $PROJ_PATH/debbuilder/nubomanagement-public/DEBIAN/ $BUILD_ROOT/DEBIAN/
sed "s/%Version%/$Version/g" -i $BUILD_ROOT/DEBIAN/control
sed "s/%Js_Version%/$Js_Version/g" -i $BUILD_ROOT/DEBIAN/control
sed "s/%Node_modules_Version%/$Node_modules_Version/g" -i $BUILD_ROOT/DEBIAN/control
sed "s/%Webplayer_Version%/$Webplayer_Version/g" -i $BUILD_ROOT/DEBIAN/control

