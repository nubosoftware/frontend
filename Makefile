
mkfile_path := $(word $(words $(MAKEFILE_LIST)),$(MAKEFILE_LIST))
nubo_proj_dir:=$(shell cd $(shell dirname $(mkfile_path))/..; pwd)
current_dir := $(shell pwd)

full_files_list := $(shell git ls-tree --full-tree -r HEAD | sed 's/^.*\t//')
webplayer_files_list := $(filter html/%,$(full_files_list))
js_files_list := $(filter-out $(webplayer_files_list),$(full_files_list))
js_files_list := $(filter-out debbuilder/% rpmbuild/%,$(js_files_list))
js_files_list := $(filter-out .gitignore Makefile rsyslog-nubomanagement-public.conf nubomanagement-public.service,$(js_files_list))
js_files_list := $(filter-out dist/%,$(js_files_list))
#js_files_list := $(filter-out src/% webpack.config.js,$(js_files_list))
src_files_list := $(filter src/%,$(full_files_list))
node_modules_files_list := package.json

default: usage

usage:
	@echo "valid tasks: all, debs, rpms, versions"

all: nubomanagement-public nubomanagement-public-common
all: nubomanagement-public-js nubomanagement-public-node_modules nubomanagement-public-webplayer

BASE_TAG := nubo_release_3.2
BASE_VERSION := 3.2

define get_current_version
$(eval $1_commit=$(shell git log -n 1 --format=oneline -- $($1_files_list)))
$(eval $1_sha1=$(shell echo "$($1_commit)" | cut -d ' ' -f 1))
$(eval $1_version=$(BASE_VERSION))
$(eval $1_buildid=$(shell git log $(BASE_TAG)..$($1_sha1) --oneline | wc -l))
$(eval $1_buildid=$(shell echo $($1_buildid)+1 | bc))
endef

define get_project_version
$(eval $1_version=$(BASE_VERSION))
$(eval $1_buildid=$(shell git log $(BASE_TAG)..HEAD --oneline | wc -l))
$(eval $1_buildid=$(shell echo $($1_buildid)+1 | bc))
endef

$(eval $(call get_project_version,public))
$(eval $(call get_project_version,common))
$(eval $(call get_current_version,js))
$(eval $(call get_current_version,node_modules))
$(eval $(call get_current_version,webplayer))


nubomanagement-public rpms: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-$(public_version)-$(public_buildid).x86_64.rpm
nubomanagement-public debs: $(nubo_proj_dir)/debs/latest/nubomanagement-public-$(public_version)-$(public_buildid).deb
nubomanagement-public:
	@echo "public version $(public_version) $(public_buildid)"

nubomanagement-public-common rpms: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-common-$(common_version)-$(common_buildid).x86_64.rpm
nubomanagement-public-common debs: $(nubo_proj_dir)/debs/latest/nubomanagement-public-common-$(common_version)-$(common_buildid).deb
nubomanagement-public-common:
	@echo "common version $(common_version) $(common_buildid)"

nubomanagement-public-js rpms: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-js-$(js_version)-$(js_buildid).x86_64.rpm
nubomanagement-public-js debs: $(nubo_proj_dir)/debs/latest/nubomanagement-public-js-$(js_version)-$(js_buildid).deb
nubomanagement-public-js:
	@echo "js version $(js_version) $(js_buildid)"

nubomanagement-public-node_modules rpms: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-node_modules-$(node_modules_version)-$(node_modules_buildid).x86_64.rpm
nubomanagement-public-node_modules debs: $(nubo_proj_dir)/debs/latest/nubomanagement-public-node-modules-$(node_modules_version)-$(node_modules_buildid).deb
nubomanagement-public-node_modules:
	@echo "node_modules version $(node_modules_version) $(node_modules_buildid)"

nubomanagement-public-webplayer rpms: $(nubo_proj_dir)/rpms/latest/nubomanagement-public-webplayer-$(webplayer_version)-$(webplayer_buildid).x86_64.rpm
nubomanagement-public-webplayer debs: $(nubo_proj_dir)/debs/latest/nubomanagement-public-webplayer-$(webplayer_version)-$(webplayer_buildid).deb
nubomanagement-public-webplayer:
	@echo "webplayer version $(webplayer_version) $(webplayer_buildid)"

versions:
	@echo "public version $(public_version) $(public_buildid)"
	@echo "common version $(common_version) $(common_buildid)"
	@echo "js version $(js_version) $(js_buildid)"
	@echo "node_modules version $(node_modules_version) $(node_modules_buildid)"
	@echo "webplayer version $(webplayer_version) $(webplayer_buildid)"

docker: debs
	mkdir -p docker_build/debs/
	cp $(nubo_proj_dir)/debs/latest/nubomanagement-public-webplayer-$(webplayer_version)-$(webplayer_buildid).deb docker_build/debs/nubomanagement-public-webplayer.deb
	cp $(nubo_proj_dir)/debs/latest/nubomanagement-public-node-modules-$(node_modules_version)-$(node_modules_buildid).deb docker_build/debs/nubomanagement-public-node-modules.deb
	cp $(nubo_proj_dir)/debs/latest/nubomanagement-public-js-$(js_version)-$(js_buildid).deb docker_build/debs/nubomanagement-public-js.deb
	cp $(nubo_proj_dir)/debs/latest/nubomanagement-public-common-$(common_version)-$(common_buildid).deb docker_build/debs/nubomanagement-public-common.deb
	cp $(nubo_proj_dir)/debs/latest/nubomanagement-public-$(public_version)-$(public_buildid).deb docker_build/debs/nubomanagement-public.deb
	cp $(nubo_proj_dir)/debs/latest/nubo-common-3.0-1.deb docker_build/debs/nubo-common.deb
	sudo docker build -t nubofrontend:$(public_version)-$(public_buildid) docker_build/.

rpms debs: versions

define make_rpm
$(eval cur_version=$(shell echo "$2" | sed 's/.*\(3\.2\)\-\([0-9]*\)\.\(.*\)/\1/'))
$(eval cur_buildid=$(shell echo "$2" | sed 's/.*\(3\.2\)\-\([0-9]*\)\.\(.*\)/\2/'))
$(eval cur_arch=$(shell echo "$2" | sed 's/.*\(3\.2\)\-\([0-9]*\)\.\(.*\)/\3/'))
#echo "rpm version $(cur_version) $(cur_buildid) $(cur_arch)"
$(eval pkgname=$(subst -$2.rpm,,$(notdir $1)))
NUBO_PROJ_PATH=$(nubo_proj_dir) \
PROJ_PATH=$(nubo_proj_dir)/nubomanagement-public \
rpmbuild -v \
$3 \
--define "_topdir $(nubo_proj_dir)/nubomanagement-public/rpmbuild" \
--define "_version $(cur_version)" \
--define "_release $(cur_buildid)" \
--define "_build_id_links none" \
-ba rpmbuild/SPECS/$(pkgname).spec
echo PACKAGE: $(pkgname)
cp $(nubo_proj_dir)/nubomanagement-public/rpmbuild/RPMS/$(cur_arch)/$(pkgname)-$(cur_version)-$(cur_buildid).$(cur_arch).rpm $(nubo_proj_dir)/rpms/latest/
endef

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-common-%.rpm:
	$(eval versions_line=\
	--define "Js_Version $(js_version)-$(js_buildid)" \
	--define "Node_modules_Version $(node_modules_version)-$(node_modules_buildid)" \
	--define "Webplayer_Version $(webplayer_version)-$(webplayer_buildid)" \
	)
	$(call make_rpm,$@,$*,$(versions_line))

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-node_modules-%.rpm: $(node_modules_files_list)
	$(call make_rpm,$@,$*)

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-js-%.rpm: $(js_files_list)
	$(call make_rpm,$@,$*)

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-webplayer-%.rpm: $(webplayer_files_list)
	$(call make_rpm,$@,$*)

$(nubo_proj_dir)/rpms/latest/nubomanagement-public-%.rpm:
	$(call make_rpm,$@,$*)

define make_deb
$(eval cur_version=$(shell echo "$2" | sed 's/.*\(3\.2\)\-\([0-9]*\)/\1/'))
$(eval cur_buildid=$(shell echo "$2" | sed 's/.*\(3\.2\)\-\([0-9]*\)/\2/'))
#echo "rpm version $(cur_version) $(cur_buildid) $(cur_arch)"
$(eval pkgname=$(subst -$2.deb,,$(notdir $1)))
$(eval pkgname=$(subst -$(cur_version)-$(cur_buildid).deb,,$(notdir $@)))
$3 \
NUBO_PROJ_PATH=$(nubo_proj_dir) \
PROJ_PATH=$(current_dir) \
Version=$(cur_version).$(cur_buildid) \
./debbuilder/$(pkgname)/debbuilder.sh && \
fakeroot dpkg-deb -b debbuild/$(pkgname) $(nubo_proj_dir)/debs/latest/$(pkgname)-$(cur_version)-$(cur_buildid).deb
endef

$(nubo_proj_dir)/debs/latest/nubomanagement-public-common-%.deb:
	$(eval versions_line=\
	Js_Version=$(js_version).$(js_buildid) \
	Node_modules_Version=$(node_modules_version).$(node_modules_buildid) \
	Webplayer_Version=$(webplayer_version).$(webplayer_buildid) \
	)
	$(call make_deb,$@,$*,$(versions_line))

$(nubo_proj_dir)/debs/latest/nubomanagement-public-node-modules-%.deb: $(node_modules_files_list)
	$(call make_deb,$@,$*)

$(nubo_proj_dir)/debs/latest/nubomanagement-public-js-%.deb: $(src_files_list)
	$(call make_deb,$@,$*)

$(nubo_proj_dir)/debs/latest/nubomanagement-public-webplayer-%.deb: $(webplayer_files_list)
	$(call make_deb,$@,$*)

$(nubo_proj_dir)/debs/latest/nubomanagement-public-%.deb:
	$(call make_deb,$@,$*)


.PHONY: default clean nubomanagement nubomanagement-public nubomanagement-public-common
.PHONY: nubomanagement-public-js nubomanagement-public-node_modules nubomanagement-public-webplayer

clean:

