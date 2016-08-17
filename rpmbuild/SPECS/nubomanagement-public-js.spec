Summary: nubomanagement service
Name: nubomanagement-public-js
Version: %{_version}
Release: %{_release}
Group: System Environment/Daemons
BuildArch: x86_64
License: none
Requires: node-forever, nodejs >= 4.4.5, nubo-common, nubomanagement-public

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
mkdir -p $RPM_BUILD_ROOT/opt/nubomanagement-public

#Copy js files from git project
FILES=`git ls-tree --full-tree -r HEAD | awk '
($4 ~ /.+\.js$/) || ($4 ~ /^unittests\/.+/) {print $4}
'`

for file in ${FILES}; do
    install -D -m 644 $NUBO_PROJ_PATH/nubomanagement-public/$file $RPM_BUILD_ROOT/opt/nubomanagement-public/$file
done
install -m 644 $NUBO_PROJ_PATH/nubomanagement-public/Settings.json.init $RPM_BUILD_ROOT/opt/nubomanagement-public/Settings.json
rm -rf $RPM_BUILD_ROOT/opt/nubomanagement-public/html

%post

%preun

%postun

%clean
rm -rf $RPM_BUILD_ROOT

%files
%defattr(-,root,root)

/opt/nubomanagement-public
%config(noreplace) /opt/nubomanagement-public/Settings.json

