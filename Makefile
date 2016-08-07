
mkfile_path := $(word $(words $(MAKEFILE_LIST)),$(MAKEFILE_LIST))
nubo_proj_dir:=$(shell cd $(shell dirname $(mkfile_path))/..; pwd)

include NuboVersion.txt
VERSIONLINE=$(MAJOR).$(MINOR).$(PATCHLEVEL)

default: rpm 

rpm: nubomanagement-public nubomanagement-public-common
rpm: nubomanagement-public-js nubomanagement-public-node_modules nubomanagement-public-webplayer


nubomanagement-public: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-$(VERSIONLINE)-$(BUILDID).x86_64.rpm

nubomanagement-public-common: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-common-$(VERSIONLINE)-$(BUILDID).x86_64.rpm

nubomanagement-public-js: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-js-$(VERSIONLINE)-$(BUILDID).x86_64.rpm

nubomanagement-public-node_modules: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-node_modules-$(VERSIONLINE)-$(BUILDID).x86_64.rpm

nubomanagement-public-webplayer: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-webplayer-$(VERSIONLINE)-$(BUILDID).x86_64.rpm

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-$(VERSIONLINE)-$(BUILDID).x86_64.rpm \
$(nubo_proj_dir)/rpms/latest/nubomanagement-public-common-$(VERSIONLINE)-$(BUILDID).x86_64.rpm \
$(nubo_proj_dir)/rpms/latest/nubomanagement-public-js-$(VERSIONLINE)-$(BUILDID).x86_64.rpm \
$(nubo_proj_dir)/rpms/latest/nubomanagement-public-node_modules-$(VERSIONLINE)-$(BUILDID).x86_64.rpm \
$(nubo_proj_dir)/rpms/latest/nubomanagement-public-webplayer-$(VERSIONLINE)-$(BUILDID).x86_64.rpm:
	$(eval pkgname=$(subst -$(VERSIONLINE)-$(BUILDID).x86_64.rpm,,$(notdir $@)))
	echo PACKAGE: $(pkgname)
	NUBO_PROJ_PATH=$(nubo_proj_dir) \
	PROJ_PATH=$(nubo_proj_dir)/nubomanagement-public \
	rpmbuild -v \
	--define "_topdir $(nubo_proj_dir)/nubomanagement-public/rpmbuild" \
	--define "_version $(VERSIONLINE)" \
	--define "_release $(BUILDID)" \
	-ba rpmbuild/SPECS/$(pkgname).spec
	echo PACKAGE: $(pkgname)
	cp $(nubo_proj_dir)/nubomanagement-public/rpmbuild/RPMS/x86_64/$(pkgname)-$(VERSIONLINE)-$(BUILDID).x86_64.rpm $(nubo_proj_dir)/rpms/latest/

.PHONY: default clean nubomanagement nubomanagement-public nubomanagement-public-common
.PHONY: nubomanagement-public-js nubomanagement-public-node_modules nubomanagement-public-webplayer

clean:

