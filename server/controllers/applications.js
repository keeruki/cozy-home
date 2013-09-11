// Generated by CoffeeScript 1.6.2
var AppManager, Application, DescriptionManager, PermissionsManager, fs, mark_broken, randomString, request, saveIcon, send_error, send_error_socket, slugify;

request = require("request-json");

fs = require('fs');

slugify = require('cozy-slug');

Application = require('../models/application');

AppManager = require('../lib/paas').AppManager;

PermissionsManager = require('../lib/permissions').PermissionsManager;

DescriptionManager = require('../lib/description').DescriptionManager;

send_error = function(res, err, code) {
  if (code == null) {
    code = 500;
  }
  if (err == null) {
    err = {
      stack: null,
      message: "Server error occured"
    };
  }
  console.log("Sending error to client :");
  console.log(err.stack);
  return res.send(code, {
    error: true,
    success: false,
    message: err.message,
    stack: err.stack
  });
};

send_error_socket = function(err) {
  return compound.io.sockets.emit('installerror', err.stack);
};

mark_broken = function(res, app, err) {
  console.log("Marking app " + app.name + " as broken because");
  console.log(err.stack);
  app.state = "broken";
  app.password = null;
  app.errormsg = err.message;
  return app.save(function(saveErr) {
    if (saveErr) {
      return send_error(res, saveErr);
    }
    return res.send({
      app: app,
      error: true,
      success: false,
      message: err.message,
      stack: err.stack
    }, 500);
  });
};

randomString = function(length) {
  var string;

  string = "";
  while (string.length < length) {
    string = string + Math.random().toString(36).substr(2);
  }
  return string.substr(0, length);
};

saveIcon = function(appli, callback) {
  var client, tmpName;

  if (callback == null) {
    callback = function() {};
  }
  if ((appli != null) && (appli.port != null)) {
    client = request.newClient("http://localhost:" + appli.port + "/");
    tmpName = "/tmp/icon_" + appli.slug + ".png";
    return client.saveFile("icons/main_icon.png", tmpName, function(err, res, body) {
      if (err) {
        return callback(err);
      }
      return appli.attachFile(tmpName, {
        name: 'icon.png'
      }, function(err) {
        fs.unlink(tmpName);
        if (err) {
          return callback(err);
        }
        return callback(null);
      });
    });
  } else {
    return callback(new Error('Appli cannot be reached'));
  }
};

module.exports = {
  loadApplication: function(req, res, next, slug) {
    return Application.all({
      key: req.params.slug
    }, function(err, apps) {
      if (err) {
        return next(err);
      } else if (apps === null || apps.length === 0) {
        return res.send(404, {
          error: 'Application not found'
        });
      } else {
        req.application = apps[0];
        return next();
      }
    });
  },
  applications: function(req, res, next) {
    return Application.all(function(err, apps) {
      if (err) {
        return next(err);
      } else {
        return res.send({
          rows: apps
        });
      }
    });
  },
  getPermissions: function(req, res, next) {
    var permissions;

    permissions = new PermissionsManager();
    return permissions.get(req.body, function(err, docTypes) {
      var app;

      if (err) {
        return next(err);
      } else {
        app = {
          permissions: docTypes
        };
        return res.send({
          success: true,
          app: app
        });
      }
    });
  },
  getDescription: function(req, res, next) {
    var description;

    description = new DescriptionManager();
    return description.get(req.body, function(err, description) {
      var app;

      app = {
        description: description
      };
      return res.send({
        success: true,
        app: app
      });
    });
  },
  getMetaData: function(req, res, next) {
    var metaDataManager;

    metaDataManager = new DescriptionManager();
    return metaDataManager.get(req.body, function(metaData) {
      return res.send({
        success: true,
        app: metaData
      }, 200);
    });
  },
  read: function(req, res, next) {
    return Application.find(req.params.id, function(err, app) {
      if (err) {
        return send_error(res, err);
      } else if (app === null) {
        return send_error(res, new Error('Application not found'), 404);
      } else {
        return res.send(app);
      }
    });
  },
  icon: function(req, res, next) {
    var _ref, _ref1,
      _this = this;

    if ((_ref = req.application) != null ? (_ref1 = _ref._attachments) != null ? _ref1['icon.png'] : void 0 : void 0) {
      return req.application.getFile('icon.png', (function() {})).pipe(res);
    }
    return saveIcon(req.application, function(err) {
      if (err) {
        return fs.createReadStream('./client/app/assets/img/stopped.png').pipe(res);
      }
      return req.application.getFile('icon.png', (function() {})).pipe(res);
    });
  },
  updatestoppable: function(req, res, next) {
    return Application.find(req.params.id, function(err, app) {
      if (err) {
        return send_error(res, err);
      } else if (app === null) {
        return send_error(res, new Error('Application not found'), 404);
      } else {
        return app.updateAttributes({
          isStoppable: req.body.isStoppable
        }, function(err, app) {
          if (err) {
            return send_error(res, err);
          }
          return res.send(app);
        });
      }
    });
  },
  install: function(req, res, next) {
    req.body.slug = slugify(req.body.name);
    req.body.state = "installing";
    req.body.password = randomString(32);
    return Application.all({
      key: req.body.slug
    }, function(err, apps) {
      var permissions;

      if (err) {
        return send_error(res, err);
      }
      if (apps.length > 0 || req.body.slug === "proxy" || req.body.slug === "home" || req.body.slug === "data-system") {
        err = new Error("There is already an app with similar name");
        return send_error(res, err, 400);
      }
      permissions = new PermissionsManager();
      return permissions.get(req.body, function(err, docTypes) {
        if (err) {
          return send_error(res, err);
        }
        req.body.permissions = docTypes;
        return Application.create(req.body, function(err, appli) {
          var infos, manager;

          if (err) {
            return send_error(res, err);
          }
          res.send({
            success: true,
            app: appli
          }, 201);
          infos = JSON.stringify(appli);
          console.info("attempt to install app " + infos);
          manager = new AppManager();
          return manager.installApp(appli, function(err, result) {
            var msg;

            if (err) {
              mark_broken(res, appli, err);
              res.send_error_socket(err);
              return;
            }
            if (result.drone != null) {
              appli.state = "installed";
              appli.port = result.drone.port;
              msg = "install succeeded on port " + appli.port;
              console.info(msg);
              saveIcon(appli, function(err) {
                if (err) {
                  return console.log(err.stack);
                } else {
                  return console.info('icon attached');
                }
              });
              return appli.save(function(err) {
                if (err) {
                  return res.send_error_socket(err);
                }
                console.info('saved port in db', appli.port);
                return manager.resetProxy(function(err) {
                  if (err) {
                    return send_error_socket(err);
                  }
                  return console.info('proxy reset', appli.port);
                });
              });
            } else {
              err = new Error("Controller has no " + ("informations about " + appli.name));
              if (err) {
                return send_error_socket(err);
              }
            }
          });
        });
      });
    });
  },
  uninstall: function(req, res, next) {
    var manager;

    req.body.slug = req.params.slug;
    manager = new AppManager();
    return manager.uninstallApp(req.application, function(err, result) {
      if (err) {
        return mark_broken(res, req.application, err);
      }
      return req.application.destroy(function(err) {
        if (err) {
          return send_error(res, err);
        }
        return manager.resetProxy(function(err) {
          if (err) {
            return send_error(res, proxyErr);
          }
          return res.send({
            success: true,
            msg: 'Application succesfuly uninstalled'
          });
        });
      });
    });
  },
  update: function(req, res, next) {
    var manager;

    manager = new AppManager();
    if (req.application.password == null) {
      req.application.password = randomString(32);
    }
    return manager.updateApp(req.application, function(err, result) {
      var permissions;

      if (err) {
        return mark_broken(res, req.application, err);
      }
      req.application.state = "installed";
      permissions = new PermissionsManager();
      return permissions.get(req.application, function(err, docTypes) {
        req.application.permissions = docTypes;
        return req.application.save(function(err) {
          saveIcon(appli, function(err) {
            if (err) {
              return console.log(err.stack);
            } else {
              return console.info('icon attached');
            }
          });
          if (err) {
            return send_error(res, err);
          }
          return manager.resetProxy(function(err) {
            if (err) {
              return mark_broken(res, req.application, err);
            }
            return res.send({
              success: true,
              msg: 'Application succesfuly updated'
            });
          });
        });
      });
    });
  },
  start: function(req, res, next) {
    var manager;

    manager = new AppManager;
    return manager.start(req.application, function(err, result) {
      if (err) {
        return mark_broken(res, req.application, err);
      }
      req.application.state = "installed";
      req.application.port = result.drone.port;
      return req.application.save(function(err) {
        if (err) {
          return send_error(res, err);
        }
        return manager.resetProxy(function(err) {
          if (err) {
            return mark_broken(res, req.application, err);
          }
          return res.send({
            success: true,
            msg: 'Application running',
            app: req.application
          });
        });
      });
    });
  },
  stop: function(req, res, next) {
    var manager;

    manager = new AppManager;
    return manager.stop(req.application, function(err, result) {
      var data;

      if (err) {
        return mark_broken(res, req.application, err);
      }
      data = {
        state: 'stopped',
        port: 0
      };
      return req.application.updateAttributes(data, function(err) {
        if (err) {
          return send_error(res, err);
        }
        return manager.resetProxy(function(err) {
          if (err) {
            return mark_broken(res, req.application, err);
          }
          return res.send({
            success: true,
            msg: 'Application stopped',
            app: req.application
          });
        });
      });
    });
  }
};
