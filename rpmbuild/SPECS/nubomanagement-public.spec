Summary: nubomanagement service (meta package)
Name: nubomanagement-public
Version: %{_version}
Release: %{_release}
Group: System Environment/Daemons
BuildArch: x86_64
License: none
Requires: nodejs >= 4.4.5, node-forever, nubomanagement-public-common = %{_version}-%{_release}

%description
nubo management web service that run in public network

%prep


%build

%install
rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT

%post

%preun

%postun


%clean


%files

