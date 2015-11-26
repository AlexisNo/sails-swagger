import path from 'path'
import _ from 'lodash'
import Marlinspike from 'marlinspike'
import xfmr from '../../../lib/xfmr'

class Swagger extends Marlinspike {

  defaults (overrides) {
    return {
      'swagger': {
        pkg: {
          name: 'No package information',
          description: 'You should set sails.config.swagger.pkg to retrieve the content of the package.json file',
          version: '0.0.0'
        },
        ui: {
          url: 'http://localhost:8080/'
        }
      },
      'routes': {
        '/swagger/doc': {
          cors: {
            origin: 'http://localhost:8080',
            methods: 'GET,OPTIONS,HEAD'
          },
          controller: 'SwaggerController',
          action: 'doc'
        }
      }
    };
  }

  constructor (sails) {
    super(sails, module);
  }

  initialize (next) {
    let sails = this.sails
    let hook = sails.hooks.swagger
    hook.routes = []
    sails.on('router:bind', function(routeObj) {
      if (['/*', '/__getcookie', '/csrfToken', '/csrftoken'].indexOf(routeObj.path) === -1
        && routeObj.options.controller) {
        hook.routes.push(routeObj)
      }
    })

    sails.after('lifted', () => {
      hook.doc = xfmr.getSwagger(sails, hook.routes, sails.config.swagger)
    })

    next()
  }
}

export default Marlinspike.createSailsHook(Swagger)
