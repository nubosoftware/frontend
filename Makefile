
mkfile_path := $(word $(words $(MAKEFILE_LIST)),$(MAKEFILE_LIST))
nubo_proj_dir:=$(shell cd $(shell dirname $(mkfile_path))/..; pwd)
current_dir := $(shell pwd)

full_files_list := $(shell git ls-tree --full-tree -r HEAD | sed 's/^.*\t//')
webplayer_files_list := $(filter html/%,$(full_files_list))
js_files_list := $(filter-out $(webplayer_files_list),$(full_files_list))
js_files_list := $(filter-out debbuilder/% rpmbuild/%,$(js_files_list))
js_files_list := $(filter-out .gitignore Makefile rsyslog-nubomanagement-public.conf,$(js_files_list))
node_modules_files_list := package.json

include NuboVersion.txt
VERSIONLINE=$(MAJOR).$(MINOR).$(PATCHLEVEL)

default: rpm

rpm: nubomanagement-public nubomanagement-public-common
rpm: nubomanagement-public-js nubomanagement-public-node_modules nubomanagement-public-webplayer

define get_current_version
$(eval $1_commit=$(shell git log -n 1 --format=oneline -- $($1_files_list)))
$(eval $1_sha1=$(shell echo "$($1_commit)" | cut -d ' ' -f 1))
$(eval $1_tag=$(shell git describe --tags "$($1_sha1)"))
$(eval $1_version=$(shell echo $($1_tag) | sed 's/.*\(1\.2\.[0-9]*\)\.\([0-9]*\).*/\1/'))
$(eval $1_buildid=$(shell echo $($1_tag) | sed 's/.*\(1\.2\.[0-9]*\)\.\([0-9]*\).*/\2/'))
$(eval $1_buildid=$(shell if [ `echo "$($1_tag)" | grep -E "\-g[a-f0-9]{7}$$"` ]; then echo $($1_buildid)+1 | bc; else echo $($1_buildid); fi))
endef

nubomanagement-public: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-$(VERSIONLINE)-$(BUILDID).x86_64.rpm

nubomanagement-public-common: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-common-$(VERSIONLINE)-$(BUILDID).x86_64.rpm

nubomanagement-public-js:
	$(call get_current_version,js)
	@echo "js version $(js_version) $(js_buildid)"
	make $(nubo_proj_dir)/rpms/latest/nubomanagement-public-js-$(js_version)-$(js_buildid).x86_64.rpm

nubomanagement-public-node_modules:
	$(call get_current_version,node_modules)
	@echo "node_modules version $(node_modules_version) $(node_modules_buildid)"
	make $(nubo_proj_dir)/rpms/latest/nubomanagement-public-node_modules-$(node_modules_version)-$(node_modules_buildid).x86_64.rpm

nubomanagement-public-webplayer:
	$(call get_current_version,webplayer)
	@echo "webplayer version $(webplayer_version) $(webplayer_buildid)"
	make $(nubo_proj_dir)/rpms/latest/nubomanagement-public-webplayer-$(webplayer_version)-$(webplayer_buildid).x86_64.rpm

define make_rpm
$(eval cur_version=$(shell echo "$2" | sed 's/.*\(1\.2\.[0-9]*\)\-\([0-9]*\)\.\(.*\)/\1/'))
$(eval cur_buildid=$(shell echo "$2" | sed 's/.*\(1\.2\.[0-9]*\)\-\([0-9]*\)\.\(.*\)/\2/'))
$(eval cur_arch=$(shell echo "$2" | sed 's/.*\(1\.2\.[0-9]*\)\-\([0-9]*\)\.\(.*\)/\3/'))
#echo "rpm version $(cur_version) $(cur_buildid) $(cur_arch)"
$(eval pkgname=$(subst -$2.rpm,,$(notdir $1)))
NUBO_PROJ_PATH=$(nubo_proj_dir) \
PROJ_PATH=$(nubo_proj_dir)/nubomanagement-public \
rpmbuild -v \
--define "_topdir $(nubo_proj_dir)/nubomanagement-public/rpmbuild" \
--define "_version $(cur_version)" \
--define "_release $(cur_buildid)" \
-ba rpmbuild/SPECS/$(pkgname).spec
echo PACKAGE: $(pkgname)
cp $(nubo_proj_dir)/nubomanagement-public/rpmbuild/RPMS/$(cur_arch)/$(pkgname)-$(cur_version)-$(cur_buildid).$(cur_arch).rpm $(nubo_proj_dir)/rpms/latest/
endef

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-common-%.rpm:
	$(call make_rpm,$@,$*)

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-node_modules-%.rpm: $(node_modules_files_list)
	$(call make_rpm,$@,$*)

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-js-%.rpm: $(js_files_list)
	$(call make_rpm,$@,$*)

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-webplayer-%.rpm: $(webplayer_files_list)
	$(call make_rpm,$@,$*)

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-%.rpm:
	$(call make_rpm,$@,$*)

.PHONY: default clean nubomanagement nubomanagement-public nubomanagement-public-common
.PHONY: nubomanagement-public-js nubomanagement-public-node_modules nubomanagement-public-webplayer

clean:

