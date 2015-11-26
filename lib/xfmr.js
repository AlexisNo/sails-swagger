import hoek from 'hoek'
import _ from 'lodash'
import Spec from './spec'

const methodMap = {
  post: 'Create Object(s)',
  get: 'Read Object(s)',
  put: 'Update Object(s)',
  patch: 'Update Object(s)',
  delete: 'Destroy Object(s)',
  options: 'Get Resource Options',
  head: 'Get Resource headers'
}


const Transformer = {

  getSwagger (sails, routeObjects, config) {
    return {
      swagger: '2.0',
      info: Transformer.getInfo(config.pkg),
      host: config.host,
      tags: Transformer.getTags(routeObjects),
      definitions: Transformer.getDefinitions(sails),
      paths: Transformer.getPaths(sails, routeObjects)
    }
  },

  /**
   * Convert a package.json file into a Swagger Info Object
   * http://swagger.io/specification/#infoObject
   */
  getInfo (pkg) {
    return hoek.transform(pkg, {
      'title': 'name',
      'description': 'description',
      'version': 'version',

      'contact.name': 'author',
      'contact.url': 'homepage',

      'license.name': 'license'
    })
  },

  /**
   * http://swagger.io/specification/#tagObject
   */
  getTags (routeObjects) {
    return _.unique(_.map(_.pluck(routeObjects, 'options'), option => {
      return {
        name: _.capitalize(option.controller)
        //description: `${tagName} Controller`
      }
    }), 'name')
  },

  /**
   * http://swagger.io/specification/#definitionsObject
   */
  getDefinitions (sails) {
    let definitions = _.transform(sails.models, (definitions, model, modelName) => {
      definitions[model.identity] = {
        properties: Transformer.getDefinitionProperties(model.definition)
      }
    })

    delete definitions['undefined']

    return definitions
  },

  getDefinitionProperties (definition) {
    return _.mapValues(definition, (def, attrName) => {
      let property = _.pick(def, [
        'type', 'description', 'format'
      ])

      return Spec.getPropertyType(property.type)
    })
  },

  /**
   * Convert the internal Sails route map into a Swagger Paths
   * Object
   * http://swagger.io/specification/#pathsObject
   * http://swagger.io/specification/#pathItemObject
   */
  getPaths (sails, routeObjects) {
    let routesByPath = _.reduce(routeObjects, function(result, route) {
      let path = route.path.replace(/:(\w+)\??/g, '{$1}')
      if (!result[path]) {
        result[path] = {}
      }
      result[path][route.verb] = Transformer.getPathItem(sails, route);
      return result
    }, {})

    return routesByPath;
  },

  getModelFromPath (sails, path) {
    let split = path.split('/')
    let [ $, parentModelName, parentId, childAttributeName, childId ] = path.split('/')
    let parentModel = sails.models[parentModelName]
    let childAttribute = _.get(parentModel, [ 'attributes', childAttributeName ])
    let childModelName = _.get(childAttribute, 'collection') || _.get(childAttribute, 'model')
    let childModel = sails.models[childModelName]

    return childModel || parentModel
  },

  /**
   * http://swagger.io/specification/#definitionsObject
   */
  getDefinitionReference (sails, path) {
    let model = Transformer.getModelFromPath(sails, path)
    if (model) {
      return '#/definitions/' + model.identity
    }
  },

  /**
   * http://swagger.io/specification/#pathItemObject
   */
  getPathItem (sails, routeObject) {
    return {
      summary: methodMap[routeObject.verb],
      consumes: [ 'application/json' ],
      produces: [ 'application/json' ],
      parameters: Transformer.getParameters(sails, routeObject),
      responses: Transformer.getResponses(sails, routeObject),
      tags: Transformer.getPathTags(sails, routeObject)
    }
  },

  /**
   * A list of tags for API documentation control. Tags can be used for logical
   * grouping of operations by resources or any other qualifier.
   */
  getPathTags (sails, routeObject) {
    return _.unique(_.compact([
      Transformer.getPathModelTag(sails, routeObject),
      Transformer.getPathControllerTag(sails, routeObject)
    ]))
  },

  getPathModelTag (sails, routeObject) {
    let model = Transformer.getModelFromPath(sails, routeObject.path)
    return model && model.globalId
  },

  getPathControllerTag (sails, routeObject) {
    return _.get(sails.controllers, [ routeObject.options.controller, 'globalId' ])
  },

  /**
   * http://swagger.io/specification/#parameterObject
   */
  getParameters (sails, routeObject) {
    let routeParams = routeObject.path.match(/:(\w+)\??/g)
    if (!routeParams) return

    return _.map(routeParams, param => {
      return {
        name: _.trimLeft(_.trimRight(param, '?'), ':'),
        in: 'path',
        required: true,
        type: 'string'
      }
    })
  },

  /**
   * http://swagger.io/specification/#responsesObject
   */
  getResponses (sails, routeObject) {
    let $ref = Transformer.getDefinitionReference(sails, routeObject.path)
    let ok = {
      description: 'The requested resource'
    }
    if ($ref) {
      ok.schema = { '$ref': $ref }
    }
    return {
      '200': ok,
      '404': { description: 'Resource not found' },
      '500': { description: 'Internal server error' }
    }
  }
}

export default Transformer
