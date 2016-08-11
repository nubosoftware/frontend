BUILD_ROOT=${BUILD_ROOT:="$PROJ_PATH/debbuild"}/nubomanagement-public-common
Version=${Version:="1.2.0.0"}

echo "NUBO_PROJ_PATH $NUBO_PROJ_PATH"
echo "BUILD_ROOT $BUILD_ROOT"

rm -rf $BUILD_ROOT
mkdir -p $BUILD_ROOT/etc/init.d
mkdir -p $BUILD_ROOT/etc/rsyslog.d

install -m 744 $NUBO_PROJ_PATH/scripts/rootfs/etc/init.d/nubomanagement-public $BUILD_ROOT/etc/init.d/nubomanagement-public
install -m 644 $NUBO_PROJ_PATH/nubomanagement-public/rsyslog-nubomanagement-public.conf $BUILD_ROOT/etc/rsyslog.d/18-nubomanagement-public.conf


rsync -r $PROJ_PATH/debbuilder/nubomanagement-public-common/DEBIAN/ $BUILD_ROOT/DEBIAN/
sed "s/%Version%/$Version/g" -i $BUILD_ROOT/DEBIAN/control

