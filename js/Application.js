/*
 Copyright 2020 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";

class Application extends AppBase {

  // PORTAL //
  portal;

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // APP TITLE //
        this.title = this.title || map?.portalItem?.title || 'Application';
        // APP DESCRIPTION //
        this.description = this.description || map?.portalItem?.description || group?.description || '...';

        // USER SIGN-IN //
        this.configUserSignIn();

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').removeAttribute('active');
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {
    if (this.oauthappid || this.portal?.user) {

      const signIn = document.getElementById('sign-in');
      signIn && (signIn.portal = this.portal);

    }
  }

  /**
   *
   * @param view
   */
  configView(view) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/widgets/Home',
          'esri/widgets/Search',
          'esri/widgets/LayerList',
          'esri/widgets/Legend'
        ], (Home, Search, LayerList, Legend) => {

          //
          // CONFIGURE VIEW SPECIFIC STUFF HERE //
          //
          view.set({
            constraints: {snapToZoom: false},
            qualityProfile: "high"
          });

          // HOME //
          const home = new Home({view});
          view.ui.add(home, {position: 'top-left', index: 0});

          // LEGEND //
          /*
           const legend = new Legend({ view: view });
           view.ui.add(legend, {position: 'bottom-left', index: 0});
           */

          // SEARCH /
          const search = new Search({view: view});
          view.ui.add(search, {position: 'top-left', index: 0});

          // LAYER LIST //
          /*const layerList = new LayerList({
           container: 'layer-list-container',
           view: view,
           listItemCreatedFunction: (event) => {
           event.item.open = (event.item.layer.type === 'group');
           },
           visibleElements: {statusIndicators: true}
           });*/

          // VIEW UPDATING //
          const viewUpdating = document.getElementById('view-updating');
          view.ui.add(viewUpdating, 'bottom-right');
          this._watchUtils.init(view, 'updating', updating => {
            viewUpdating.toggleAttribute('active', updating);
          });

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView(view).then(() => {

        this.initializeViewsheds(view);

        resolve();
      }).catch(reject);
    });
  }

  /**
   *
   * @param view
   */
  initializeViewsheds(view) {
    require([
      'esri/config',
      'esri/Color',
      "esri/Graphic",
      "esri/geometry/geometryEngine",
      "esri/layers/GraphicsLayer",
      "esri/layers/FeatureLayer",
      "esri/rest/support/FeatureSet",
      "esri/rest/geoprocessor"
    ], (esriConfig, Color, Graphic, geometryEngine,
        GraphicsLayer, FeatureLayer, FeatureSet, geoprocessor) => {

      const areaFormatter = new Intl.NumberFormat('default', {minimumFractionDigits: 2, maximumFractionDigits: 2});

      const viewshedList = document.getElementById('viewshed-list');
      const viewshedItemTemplate = document.getElementById('viewshed-item-template');
      const clearViewshedsAction = document.getElementById('clear-viewsheds-action');
      const maximumDistanceInput = document.getElementById('maximumDistanceInput');
      const observerHeightInput = document.getElementById('observerHeightInput');
      const surfaceOffsetInput = document.getElementById('surfaceOffsetInput');
      const overlapAreaInput = document.getElementById('overlap-area-input');


      const statusNotice = document.getElementById('status-notice');
      view.ui.add(statusNotice, 'top-right');

      // VIEWSHED FIELDS //
      const viewshed_fields = [
        {name: "OBJECTID", type: "oid", alias: "OBJECTID", visible: false},
        {name: "Frequency", type: "integer", alias: "Frequency", visible: false},
        {name: "DEMResolution", type: "string", alias: "DEM Resolution", length: 50, visible: true},
        {name: "ProductName", type: "string", alias: "Product Name", length: 50, visible: true},
        {name: "Source", type: "string", alias: "Source", length: 50, visible: true},
        {name: "Source_URL", type: "string", alias: "Source URL", length: 84, visible: true},
        {name: "PerimeterKm", type: "double", alias: "Perimeter Kilometers", visible: true},
        {name: "AreaSqKm", type: "double", alias: "Area Square Kilometers", visible: true},
        {name: "Shape_Length", type: "double", alias: "Shape Length", visible: false},
        {name: "Shape_Area", type: "double", alias: "Shape Area", visible: false},
      ];

      // FIELD INFOS //
      const fieldInfos = viewshed_fields.map(field => {
        return {
          fieldName: field.name,
          label: field.alias,
          visible: field.visible,
          format: (field.type === "double") ? {digitSeparator: true, places: 2} : null
        };
      });

      const getColor = (color, opacity) => {
        const clr = new Color(color);
        clr.a = opacity;
        return clr;
      };

      // VIEWSHED LAYER //
      const viewshedResultsLayer = new FeatureLayer({
        objectIdField: "OBJECTID",
        geometryType: "polygon",
        spatialReference: {wkid: 102100},
        source: [],
        elevationInfo: {mode: "on-the-ground"},
        fields: viewshed_fields,
        popupTemplate: {
          title: "{ProductName} @ {DEMResolution}",
          content: [
            {type: "fields", fieldInfos: fieldInfos}
          ]
        },
        renderer: {
          type: "simple",
          symbol: {
            type: "polygon-3d",
            symbolLayers: [
              {
                type: "fill",
                material: {color: getColor('red', 0.2)},
                outline: {color: getColor('red', 0.5), size: 0.5}
              }
            ]
          }
        }
      });

      // OVERLAP LAYER //
      const overlappingAreasLayer = new FeatureLayer({
        fields: [{name: "OBJECTID", type: "oid", alias: "OBJECTID"}],
        objectIdField: "OBJECTID",
        geometryType: "polygon",
        spatialReference: {wkid: 102100},
        source: [],
        elevationInfo: {mode: "on-the-ground"},
        renderer: {
          type: "simple",
          symbol: {
            type: "polygon-3d",
            symbolLayers: [
              {
                type: "fill",
                material: {color: getColor('yellow', 0.5)},
                outline: {color: getColor('yellow', 0.8), size: 1.5},
                pattern: {type: "style", style: 'diagonal-cross'}
              }
            ]
          }
        }
      });

      // DISTANCE LAYER //
      const distanceBufferLayer = new FeatureLayer({
        objectIdField: "OBJECTID",
        geometryType: "polygon",
        spatialReference: {wkid: 102100},
        source: [],
        elevationInfo: {mode: "on-the-ground"},
        fields: [{name: "OBJECTID", type: "oid", alias: "OBJECTID"}],
        renderer: {
          type: "simple",
          symbol: {
            type: "polygon-3d",
            symbolLayers: [
              {
                type: "fill",
                material: {color: getColor('white', 0.0)},
                outline: {color: getColor('white', 0.8), size: 1.0}
              }
            ]
          }
        }
      });

      // OBSERVER LOCATION //
      const observerLocationLayer = new FeatureLayer({
        objectIdField: "OBJECTID",
        geometryType: "point",
        hasZ: true,
        spatialReference: {wkid: 102100},
        source: [],
        elevationInfo: {mode: "absolute-height"},
        fields: [
          {name: "OBJECTID", type: "oid", alias: "OBJECTID"}
        ],
        labelingInfo: [{
          labelExpressionInfo: {
            expression: "$feature.OBJECTID"
          },
          symbol: {
            type: "text",
            color: "white",
            haloColor: "#242424",
            haloSize: 1.5,
            font: {
              size: 17,
              weight: "bold"
            }
          }
        }],
        renderer: {
          type: "simple",
          symbol: {
            type: "point-3d",
            symbolLayers: [
              {
                type: "object",
                width: 50,
                depth: 50,
                height: 250,
                resource: {primitive: "inverted-cone"},
                material: {color: "white"}
              }
            ]
          }
        }
      });

      view.map.addMany([observerLocationLayer, distanceBufferLayer, viewshedResultsLayer, overlappingAreasLayer]);

      view.whenLayerView(viewshedResultsLayer).then(viewshedResultsLayerView => {
        view.whenLayerView(distanceBufferLayer).then(distanceBufferLayerView => {
          view.whenLayerView(observerLocationLayer).then(observerLocationLayerView => {

            clearViewshedsAction.addEventListener('click', () => {
              viewshedList.replaceChildren();
              Promise.all([
                clearOverlapGraphic(),
                clearObserverGraphics(),
                clearDistanceGraphics(),
                clearViewshedResults()
              ]).then(() => {
                clearVisibilityFilters();
              });
            });

            const updateViewshedVisibility = (newOIDs = []) => {
              viewshedList.getSelectedItems().then((selection) => {
                const selectedObjectIDs = Array.from(selection.keys()).map(Number);
                const objectIDs = [...selectedObjectIDs, ...newOIDs];
                const filter = {where: `(OBJECTID IN (${ objectIDs.join(',') }))`};
                viewshedResultsLayerView.filter = filter;
                distanceBufferLayerView.filter = filter;
                observerLocationLayerView.filter = filter;
              });
            };

            const clearVisibilityFilters = () => {
              viewshedResultsLayerView.filter = null;
              distanceBufferLayerView.filter = null;
              observerLocationLayerView.filter = null;
            }

            // UPDATE OBSERVER GRAPHIC //
            const updateObserverGraphic = (location, offset) => {
              return new Promise((resolve, reject) => {
                const addFeatures = [];
                if (location) {
                  const observerLocation = location.clone();
                  observerLocation.z += offset || 0.0;
                  addFeatures.push({
                    geometry: observerLocation,
                    attributes: {offset: offset || 0.0}
                  })
                }
                observerLocationLayer.applyEdits({addFeatures: addFeatures}).then(applyEditResponse => {
                  const newOID = applyEditResponse.addFeatureResults[0].objectId;
                  resolve(newOID);
                });
              });
            };

            const clearObserverGraphics = (removeOID) => {
              return new Promise((resolve, reject) => {
                const observersQuery = observerLocationLayer.createQuery();
                observersQuery.set({
                  where: (removeOID != null) ? `(OBJECTID = ${ removeOID })` : `1=1`
                });
                observerLocationLayer.queryFeatures(observersQuery).then(observerFS => {
                  if (observerFS.features.length > 0) {
                    observerLocationLayer.applyEdits({deleteFeatures: observerFS.features}).then(resolve).catch(reject);
                  } else { resolve(); }
                }).catch(reject);
              });
            };

            // UPDATE DISTANCE GRAPHIC //
            const updateDistanceGraphic = (distance_buffer) => {
              const addFeatures = (distance_buffer) ? [{geometry: distance_buffer}] : [];
              distanceBufferLayer.applyEdits({addFeatures: addFeatures}).then(applyEditResponse => {
                const newOID = applyEditResponse.addFeatureResults[0].objectId;
              });
            };

            const clearDistanceGraphics = (removeOID) => {
              return new Promise((resolve, reject) => {
                const distanceQuery = distanceBufferLayer.createQuery();
                distanceQuery.set({
                  where: (removeOID != null) ? `(OBJECTID = ${ removeOID })` : `1=1`
                });
                distanceBufferLayer.queryFeatures(distanceQuery).then(distanceFS => {
                  if (distanceFS.features.length > 0) {
                    distanceBufferLayer.applyEdits({deleteFeatures: distanceFS.features}).then(resolve).catch(reject);
                  } else { resolve(); }
                }).catch(reject);
              });
            };

            // UPDATE VIEWSHED RESULTS //
            const updateViewshedResults = (viewshedFeature) => {
              return new Promise((resolve, reject) => {
                const addFeatures = (viewshedFeature != null) ? [viewshedFeature] : [];
                viewshedResultsLayer.applyEdits({addFeatures: addFeatures}).then(() => {
                  updateViewshedList(viewshedFeature);
                  resolve();
                });
              });
            };

            const clearViewshedResults = (removeOID) => {
              return new Promise((resolve, reject) => {
                const viewshedQuery = viewshedResultsLayer.createQuery();
                viewshedQuery.set({
                  where: (removeOID != null) ? `(OBJECTID = ${ removeOID })` : `1=1`
                });
                viewshedResultsLayer.queryFeatures(viewshedQuery).then(viewshedFS => {
                  if (viewshedFS.features.length > 0) {
                    viewshedResultsLayer.applyEdits({deleteFeatures: viewshedFS.features}).then(resolve).catch(reject);
                  } else { resolve(); }
                }).catch(reject);
              });
            };

            const removeViewshedFeature = (removeOID) => {
              Promise.all([
                clearViewshedResults(removeOID),
                clearDistanceGraphics(removeOID),
                clearObserverGraphics(removeOID)
              ]).then(() => {
                resetOverlapArea();
                updateViewshedVisibility();
              });
            };

            // UPDATE OVERLAP GRAPHIC //
            const updateOverlapGraphic = (overlapArea) => {
              return new Promise((resolve, reject) => {
                const addFeatures = (overlapArea) ? [{geometry: overlapArea}] : [];
                overlappingAreasLayer.queryFeatures().then(overlapFS => {
                  if ((addFeatures.length > 0) || (overlapFS.features.length > 0)) {
                    overlappingAreasLayer.applyEdits({addFeatures: addFeatures, deleteFeatures: overlapFS.features}).then(applyEditResponse => {
                      //const newOID = applyEditResponse.addFeatureResults[0].objectId;
                      const overlapAreaSqKm = geometryEngine.geodesicArea(overlapArea, 'square-kilometers');
                      overlapAreaInput.value = areaFormatter.format(overlapAreaSqKm);
                      resolve();
                    }).catch(reject);
                  } else {
                    overlapAreaInput.value = 0.0;
                    resolve();
                  }
                }).catch(reject);
              });
            };

            const clearOverlapGraphic = () => {
              return new Promise((resolve, reject) => {
                overlapAreaInput.value = 0.0;
                overlappingAreasLayer.queryFeatures().then(overlapFS => {
                  if (overlapFS.features.length > 0) {
                    overlappingAreasLayer.applyEdits({deleteFeatures: overlapFS.features}).then(resolve).catch(reject);
                  }
                }).catch(reject);
              });
            };

            const calculateOverlapArea = (newViewshedPolygon) => {
              return new Promise((resolve, reject) => {
                overlappingAreasLayer.queryFeatures().then(overlapFS => {
                  let newOverlapArea;
                  if (overlapFS.features.length > 0) {
                    const previousOverlapArea = overlapFS.features[0].geometry;
                    newOverlapArea = geometryEngine.intersect(previousOverlapArea, newViewshedPolygon);
                  } else {
                    newOverlapArea = newViewshedPolygon.clone();
                  }
                  updateOverlapGraphic(newOverlapArea).then(resolve).catch(reject);
                }).catch(reject);
              });
            };

            const resetOverlapArea = () => {
              return new Promise((resolve, reject) => {
                viewshedResultsLayer.queryFeatures().then(viewshedFS => {
                  const newOverlapArea = viewshedFS.features.reduce((overlapArea, viewshedFeature) => {
                    if (overlapArea) {
                      return geometryEngine.intersect(overlapArea, viewshedFeature.geometry);
                    } else {
                      return viewshedFeature.geometry;
                    }
                  }, null);
                  if (newOverlapArea) {
                    updateOverlapGraphic(newOverlapArea).then(resolve).catch(reject);
                  } else {
                    clearOverlapGraphic().then(resolve).catch(reject)
                  }
                }).catch(reject);
              });
            };

            const updateViewshedList = (viewshedFeature) => {
              const template = viewshedItemTemplate.content.cloneNode(true);
              const listItem = template.querySelector('calcite-pick-list-item');

              /**
               AreaSqKm: 14.9272445073216
               DEMResolution: "10m"
               Frequency: 1
               OBJECTID: 1
               PerimeterKm: 44.819116483871
               ProductName: "NED_1r3_arcsec"
               Shape_Area: 21452111.226078987
               Shape_Length: 53729.981230288664
               Source: "USGS"
               Source_URL: "http://ned.usgs.gov"
               */

              const oid = viewshedFeature.getAttribute('OBJECTID');
              const areaSqKM = areaFormatter.format(viewshedFeature.getAttribute('AreaSqKm'));
              const demResolution = viewshedFeature.getAttribute('DEMResolution');
              const productName = viewshedFeature.getAttribute('ProductName');
              const source = viewshedFeature.getAttribute('Source');

              listItem.setAttribute('label', `ID: ${ oid } | Area: ${ areaSqKM } SqKm`);
              listItem.setAttribute('description', `Source: ${ demResolution } from '${ productName }' by ${ source }`);
              listItem.setAttribute('value', oid);
              listItem.addEventListener('calciteListItemChange', ({}) => {
                updateViewshedVisibility();
              });

              const removeAction = template.querySelector('calcite-action');
              removeAction.addEventListener('click', () => {
                listItem.remove();
                removeViewshedFeature(oid);
              });

              viewshedList.append(listItem);
            }

            //
            // JOB STATUS UPDATE //
            //
            const jobInfoNode = document.getElementById("job-info");
            const jobStatusUpdate = (jobInfo) => {
              switch (jobInfo.jobStatus) {
                case "job-new":
                case "job-submitted":
                case "job-waiting":
                  jobInfoNode.innerHTML = `Calculating viewshed...`;
                  break;
                case "job-executing":
                  jobInfoNode.innerHTML = `Status: ${ jobInfo.jobStatus.replace(/job-/, "") }...`;
                  break;
                case "job-cancelling":
                case "job-cancelled":
                case "job-deleting":
                case "job-deleted":
                case "job-timed-out":
                case "job-failed":
                  displayError(new Error(jobInfo.messages[0].description));
                  break;
                case "job-succeeded":
                  jobInfoNode.innerHTML = `Viewshed calculated successfully`;
                  break;
                default:
                  jobInfoNode.innerHTML = "";
              }
            };

            const displayError = (error) => {
              jobInfoNode.innerHTML = JSON.stringify(error, null, 2);
            };

            //
            // VIEWSHED SERVICE URL //
            //
            const viewshed_service_url = "https://elevation.arcgis.com/arcgis/rest/services/Tools/Elevation/GPServer/Viewshed";
            esriConfig.request.trustedServers.push("https://elevation.arcgis.com");

            const calcViewshed = (location) => {
              return new Promise((resolve, reject) => {

                // INPUT LOCATIONS //
                //  - NOTE: MAKE SURE THERE ARE NO Z VALUES SET IN THE GEOMETRY //
                const input_points = new FeatureSet({
                  features: [
                    new Graphic({
                      geometry: {
                        type: "point",
                        spatialReference: location.spatialReference,
                        hasZ: false,
                        x: location.x,
                        y: location.y,
                      }
                    })
                  ]
                });

                //
                // https://developers.arcgis.com/rest/elevation/api-reference/viewshed.htm
                // https://developers.arcgis.com/javascript/latest/api-reference/esri-tasks-support-JobInfo.html#jobStatus
                //

                const parameters = {
                  InputPoints: input_points,
                  MaximumDistance: Number(maximumDistanceInput.value),
                  MaximumDistanceUnits: "Meters",
                  DEMResolution: "FINEST", // FINEST | 10m | 24m | 30m | 90m
                  ObserverHeight: Number(observerHeightInput.value),
                  ObserverHeightUnits: "Meters",
                  SurfaceOffset: Number(surfaceOffsetInput.value),
                  SurfaceOffsetUnits: "Meters",
                  GeneralizeViewshedPolygons: true
                };

                const resultOptions = {
                  outSpatialReference: view.spatialReference,
                  returnM: true,
                  returnZ: true
                };

                // STATUS WAIT OPTIONS //
                const statusWaitOptions = {
                  interval: 2000,
                  statusCallback: jobStatusUpdate
                };

                // CALCULATE VIEWSHED //
                geoprocessor.submitJob(viewshed_service_url, parameters, resultOptions).then((jobInfo) => {
                  // JOB ID //
                  //const jobId = jobInfo.jobId;

                  // WAIT FOR TASK TO COMPLETE //
                  jobInfo.waitForJobCompletion(statusWaitOptions).then(() => {

                    // GET RESULTS //
                    jobInfo.fetchResultData('OutputViewshed', resultOptions).then(({value}) => {
                      // VIEWSHED FEATURE //
                      const viewshedFeature = value.features[0];

                      // UPDATE VIEWSHED RESULTS //
                      calculateOverlapArea(viewshedFeature.geometry).then(() => {

                        updateViewshedResults(viewshedFeature).then(resolve).catch(reject)

                      }).catch(reject);
                    }).catch(reject);
                  }).catch(reject);
                }).catch(reject);

              });
            };

            view.container.style.cursor = 'crosshair';
            view.on("click", (evt) => {
              evt.stopPropagation();

              updateObserverGraphic(evt.mapPoint, Number(observerHeightInput.value)).then((newOID) => {
                updateViewshedVisibility([newOID]);
              });

              const analysisLocation = evt.mapPoint.clone();
              analysisLocation.hasZ = false;
              let viewshedBuffer = geometryEngine.geodesicBuffer(analysisLocation, Number(maximumDistanceInput.value), "meters");
              updateDistanceGraphic(viewshedBuffer);

              view.container.style.cursor = "wait";
              jobStatusUpdate({jobStatus: "job-new"});

              statusNotice.toggleAttribute('active', true);
              calcViewshed(evt.mapPoint).then(() => {

                view.container.style.cursor = "crosshair";
                jobStatusUpdate({jobStatus: "job-succeeded"});
                statusNotice.toggleAttribute('active', false);

              }).catch(displayError);
            });
          });
        });
      });
    });
  }

}

export default new Application();
