# Can You See Me
Using the ArcGIS Online Viewshed service to evaluate inter-visitbility.

## Demo
[Can You See Me]()

## ArcGIS Elevation Analysis services
* [Getting Started](https://developers.arcgis.com/rest/elevation/api-reference/get-started-with-elevation-services.htm)
* [Viewshed](https://developers.arcgis.com/rest/elevation/api-reference/viewshed.htm)

## Geoprocessing Service
* [Geoprocessing Service URL](https://elevation.arcgis.com/arcgis/rest/services/Tools/Elevation/GPServer/Viewshed)
* [Geoprocessing Service DOC](https://elevation.arcgis.com/arcgis/rest/directories/arcgisoutput/Tools/Elevation_GPServer/Tools_Elevation/Viewshed.htm)


## Deploy

This demo is built as a static web application.

1 - Download and copy the root folder to a web accessible location\
2 - Update the configuration parameters in ./config/application.json

Update the [application.json](https://github.com/jgrayson-apl/CanYouSeeMe_Viewshed/blob/master/config/application.json) file in your favorite json editor:

|                  parameter | details                                                                                                                                                                                                                                                      |
|---------------------------:|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|              **portalUrl** | Organization or Enterprise URL; example: https://www.arcgis.com                                                                                                                                                                                              |
|             **oauthappid** | The OAuth ID that proves that you have explicitly authorized the use this web app.<br><br>You can create the Client ID through the https://developers.arcgis.com/ website, or via the web application item page, 'Settings' tab, 'App Registration' section. |
|               **webscene** | The item ID of the Web Scene used by the app.                                                                                                                                                                                                                |


### Contacts
For questions about the JavaScript web application:
> John Grayson | Prototype Specialist | Geo Experience Center\
> Esri | 380 New York St | Redlands, CA 92373 | USA\
> T 909 793 2853 x1609 | [jgrayson@esri.com](mailto:jgrayson@esri.com?subject=Can%20You%20See%20Me&body=Hi%20John,%0A%20%20I%20have%20a%20quesiton%20about%20the%Can%20You%20See%20Me%20demo.) | [GeoXC Demos](https://www.esriurl.com/GeoXCDemos) | [esri.com](https://www.esri.com)
