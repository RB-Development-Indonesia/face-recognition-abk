const video = document.getElementById("video");

Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
]).then(startWebcam);

function startWebcam() {
  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  }).then((stream) => {
    video.srcObject = stream;
  }).catch((error) => {
    console.error(error);
  });
}

let label, foto1, foto2;

// id na masih hardcode kudu na make query params
const apiUrl = 'https://rb.olipiskandar.com/api/edocs/abk/detail?id=15197';

fetch(apiUrl).then((response) => {
  if (response.ok) {
    return response.json();
  } else {
    throw new Error('Gagal mengambil data dari API.');
  }
}).then((data) => {
  if (data.data) {
    label = data.data.nama;
    foto1 = data.data.foto_1;
    foto2 = data.data.foto_2;
  } else {
    console.error('Data yang sesuai tidak ditemukan dalam respons API.');
  }
}).catch((error) => {
  console.error('Terjadi kesalahan dalam mengambil data dari API:', error);
});

function getLabeledFaceDescriptions() {
  const labels = [label];
  const photoUrls = [foto1, foto2];

  return Promise.all(
    labels.map(async (label, index) => {
      const descriptions = [];
      for (let i = 1; i <= 2; i++) {
        const img = await faceapi.fetchImage(photoUrls[index]);
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

video.addEventListener("play", async () => {
  const labeledFaceDescriptors = await getLabeledFaceDescriptions();
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    console.log(resizedDetections);

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    const results = resizedDetections.map((d) => {
      return faceMatcher.findBestMatch(d.descriptor);
    });
    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, {
        label: result,
      });
      drawBox.draw(canvas);
    });
  }, 100);
});
