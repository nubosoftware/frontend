# Frontend Component

It is part of the [Linux Remote Desktop](https://github.com/nubosoftware/linux-remote-desktop) system.


The only component that has direct access from the internet (or an outside network).

User that connects to the system using a web browser, can connect to the frontend compoent, which sends his request, either to the management service (for all user session management purposes), or to the gateway service (concerning remote display protocol traffic).

Hosts the Vue-based client modules: nubo-admin (which is the admin's control panel client) and nubo-client-desktop (which is the end user's desktop client).

### Building Instructions
```
git clone git@github.com:nubosoftware/frontend.git nubomanagement-public
cd nubomanagement-public/
npm install --only=dev
./buildWebClients.sh
make docker
```
