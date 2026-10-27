// Leaflet finds its default marker images through a CSS trick that breaks once a bundler (Vite)
// renames and moves files — markers then show as broken images. Importing the images makes Vite
// include them and gives us their final URLs, which we hand to Leaflet directly.
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Leaflet still puts the folder it detects from its CSS in front of every icon URL, so our full
// URLs would get a second copy of the path. A string here (even an empty one) turns detection off.
L.Icon.Default.imagePath = "";
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
