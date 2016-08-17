Summary: nubomanagement service common files
Name: nubomanagement-public-common
Version: %{_version}
Release: %{_release}
Group: System Environment/Daemons
BuildArch: x86_64
License: none
Requires: nubomanagement-public-js = %{Js_Version}, nubomanagement-public-node_modules = %{Node_modules_Version}, nubomanagement-public-webplayer = %{Webplayer_Version}, nubomanagement-public

%description
nubo management web service that run in public network

#%prep
#%setup -q
#%patch -p1 -b .buildroot

%build
#make -C $NUBO_PROJ_PATH clean
#make -C $NUBO_PROJ_PATH

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/etc/rc.d/init.d
mkdir -p $RPM_BUILD_ROOT/etc/rsyslog.d

install -m 755 $NUBO_PROJ_PATH/scripts/rootfs/etc/init.d/nubomanagement-public-rh $RPM_BUILD_ROOT/etc/rc.d/init.d/nubomanagement-public
install -m 644 $NUBO_PROJ_PATH/nubomanagement-public/rsyslog-nubomanagement-public.conf $RPM_BUILD_ROOT/etc/rsyslog.d/18-nubomanagement-public.conf

%post
/sbin/chkconfig --add nubomanagement-public

#Restart after every install/update
service nubomanagement-public restart > /dev/null 2>&1 ||:

%preun
if [ $1 = 0 ]; then
	#Stop service and remove from services list on full remove
	service nubomanagement-public stop >/dev/null 2>&1 ||:
	/sbin/chkconfig --del nubomanagement-public
fi

%postun
if [ "$1" -ge "1" ]; then
	#Restart service after downgrade
	service nubomanagement-public restart > /dev/null 2>&1 ||:
fi

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root)

/etc/rc.d/init.d/nubomanagement-public
%config(noreplace) /etc/rsyslog.d/18-nubomanagement-public.conf

