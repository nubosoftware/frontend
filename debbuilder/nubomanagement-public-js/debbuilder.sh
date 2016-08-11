BUILD_ROOT=${BUILD_ROOT:="$PROJ_PATH/debbuild"}/nubomanagement-public-js
Version=${Version:="1.2.0.0"}

echo "NUBO_PROJ_PATH $NUBO_PROJ_PATH"
echo "BUILD_ROOT $BUILD_ROOT"

rm -rf $BUILD_ROOT
mkdir -p $BUILD_ROOT/opt/nubomanagement-public

#Copy js files from git project
FILES=`git ls-tree --full-tree -r HEAD | awk '
($4 ~ /.+\.js$/) || ($4 ~ /^unittests\/.+/) {print $4}
'`

for file in ${FILES}; do
    install -D -m 644 $NUBO_PROJ_PATH/nubomanagement-public/$file $BUILD_ROOT/opt/nubomanagement-public/$file
done
install -m 644 $NUBO_PROJ_PATH/nubomanagement-public/Settings.json.init $BUILD_ROOT/opt/nubomanagement-public/Settings.json
rm -rf $BUILD_ROOT/opt/nubomanagement-public/html

rsync -r $PROJ_PATH/debbuilder/nubomanagement-public-js/DEBIAN/ $BUILD_ROOT/DEBIAN/
sed "s/%Version%/$Version/g" -i $BUILD_ROOT/DEBIAN/control

