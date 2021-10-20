FROM ubuntu:20.04
RUN apt-get -y update
# install linux packages
RUN apt install -y \
    curl \
    supervisor \
    rsyslog \
    vim \
    iputils-ping \
    telnet \
    dnsutils \
    net-tools \
    sudo
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
RUN apt install -y nodejs

# mark this as docker installation
RUN mkdir -p /etc/.nubo/ && \
    touch  /etc/.nubo/.docker

# install nubo debs
COPY debs /tmp
RUN apt install -y \
    /tmp/nubo-common.deb \
    /tmp/nubomanagement-public-webplayer.deb \
    /tmp/nubomanagement-public-node-modules.deb \
    /tmp/nubomanagement-public-js.deb \
    /tmp/nubomanagement-public-common.deb \
    /tmp/nubomanagement-public.deb
    
RUN rm -f /tmp/*.deb

# configure
ADD etc /etc
ADD bin /usr/bin
RUN sed -i /imklog/s/module/#module/ /etc/rsyslog.conf

# Docker config
VOLUME ["/opt/nubomanagement-public/conf","/opt/cert"]
EXPOSE 443 80
ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
CMD ["supervisord"]
