const Module = require('node:module');

class AuthService {}
class FavoritesService {}

const load = Module._load;
Module._load = function (request, parent, isMain) {
    if (request.endsWith('/auth.service') || request.endsWith('\\auth.service')) {
        return { AuthService };
    }
    if (request.endsWith('/favorites.service') || request.endsWith('\\favorites.service')) {
        return { FavoritesService };
    }
    return load.call(this, request, parent, isMain);
};
