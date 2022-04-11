FROM node:16-alpine3.15
ARG BUILD_VER=3.2
ARG TARGET_DIR=/opt/nubomanagement-public
LABEL build_ver="${BUILD_VER}"

# run required packages
RUN apk add --update supervisor rsyslog

# temporary add build dependencies
RUN apk add --no-cache --virtual .build-deps-full \
        binutils-gold \
        g++ \
        gcc \
        gnupg \
        libgcc \
        linux-headers \
        make \
        openjdk11-jre-headless \
        python3

# # configure files
ADD docker_build/etc /etc
ADD docker_build/bin /usr/local/bin
RUN mkdir -p /var/log/supervisor/
#RUN sed -i /imklog/s/module/#module/ /etc/rsyslog.conf

# mark this as docker installation
RUN mkdir -p /etc/.nubo/ && \
    touch  /etc/.nubo/.docker

# copy files to target dir
RUN mkdir -p ${TARGET_DIR}
COPY package.json ${TARGET_DIR}/.
COPY webpack.config.js ${TARGET_DIR}/.
ADD src ${TARGET_DIR}/src
ADD html ${TARGET_DIR}/html

# build web clients
RUN COPY buildWebClients.sh {TARGET_DIR}/.
WORKDIR ${TARGET_DIR}
RUN ./buildWebClients.sh
RUN rm -rf nubo-admin nubo-desktop-client buildWebClients.sh


# build web player
WORKDIR ${TARGET_DIR}/html/player
RUN java -jar compiler.jar -O SIMPLE --language_in ECMASCRIPT6 --js_output_file=out.js login.js nubocache.js uxip.js uxipReader.js uxipWriter.js wm.js zlibReader.js NuboOutputStreamMgr.js nubocache.js opengl.js ops.js
RUN rm -f login.js nubocache.js uxip.js uxipReader.js uxipWriter.js wm.js zlibReader.js NuboOutputStreamMgr.js nubocache.js opengl.js ops.js compiler.jar

WORKDIR ${TARGET_DIR}
RUN echo "VERSION: ${BUILD_VER}" > version.txt

# prepare the module
RUN npm install

# build the dist folder
RUN npm run build

# remove build dependencies
RUN rm -rf src webpack.config.js
RUN apk del .build-deps-full

# Docker config
VOLUME ["${TARGET_DIR}/conf","/opt/cert"]
EXPOSE 443 80
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["supervisord", "--nodaemon", "--configuration", "/etc/supervisor/supervisord.conf"]
