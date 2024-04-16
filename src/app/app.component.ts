import { Component, ChangeDetectorRef } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getDatabase, ref as dbRef, push, set,get } from 'firebase/database';

interface Recording {
  id: string;
  fileName: string;
  downloadURL?: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent {
  private stream?: MediaStream;
  private recordedChunks: Blob[] = [];
  private mediaRecorder?: MediaRecorder;
  isRecording = false;
  //recordings: { id: string, fileName: string }[] = [];
  recordings: Recording[] = []; 
  constructor(private changeDetector: ChangeDetectorRef) {
    // Initialize Firebase
    initializeApp({
      apiKey: "AIzaSyDcbw2muE-F_ecl3FQVA8tIGZOWZs3wunU",
      authDomain: "screenrecordingdemo-245d6.firebaseapp.com",
      projectId: "screenrecordingdemo-245d6",
      storageBucket: "screenrecordingdemo-245d6.appspot.com",
      messagingSenderId: "923761837780",
      appId: "1:923761837780:web:e33fede1dea85081ad5d41"
    });
  }

  toggleRecording() {
    if (!this.isRecording) {
      this.startRecording();
    } else {
      this.stopRecording();
    }
  }

  async startRecording() {
    this.isRecording = true;
    this.recordedChunks = [];
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      if (this.stream) {
        this.mediaRecorder = new MediaRecorder(this.stream);
        this.mediaRecorder.addEventListener('dataavailable', event => this.recordedChunks.push(event.data));
        this.mediaRecorder.start();
      }
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  }

  stopRecording() {
    this.isRecording = false;
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
    }
    this.saveRecording();
  }

  async saveRecording() {
    const blob = new Blob(this.recordedChunks, { type: 'video/mp4' });
    const id = `recording-${Date.now()}`;
    const fileName = `${id}.mp4`;
    const storageRef = ref(getStorage(), 'recordings/' + fileName);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on('state_changed',
      (snapshot) => {
        // Optional: Provide progress updates during upload
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
      },
      (error) => {
        // Handle upload errors
        console.error('Error uploading file:', error);
      },
      async () => {
        // Upload completed successfully
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

        // Store video metadata in Realtime Database
        const db = getDatabase();
        const recordingRef = dbRef(db, 'recordings/' + id);
        await set(recordingRef, {
          fileName,
          downloadURL
        });

        this.recordings.push({ id, fileName, downloadURL });
        this.recordedChunks = [];
        this.changeDetector.markForCheck();
      }
    );
  }

  async ngOnInit() {
    const recordings = await this.getRecordingFiles();
    this.recordings = recordings;
  }

  async getRecordingFiles() {
    
    const db = getDatabase();
    const recordingsRef = dbRef(db, 'recordings/');
    const snapshot = await get(recordingsRef);
  
    if (snapshot.exists()) {
      const data = snapshot.val() || {}; // Get data or empty object if not found
      for (const key in data) {
        const recording = data[key];
        this.recordings.push({ id: key, fileName: recording.fileName , downloadURL: ''});
      }
    }
  
    // Fetch download URLs from Cloud Storage after retrieving file names
    const storage = getStorage();
    for (const recording of this.recordings) {
      const storageRef = ref(storage, 'recordings/' + recording.fileName);
      const downloadURL = await getDownloadURL(storageRef)
      .catch(err => {
        console.error('Error getting download URL:', err);
        return undefined; // Return undefined if there's an error
      });
      recording.downloadURL = downloadURL; // Add downloadURL to recording object
    }
  
    return this.recordings;
  }

  createVideoUrl(fileName: string) {
    // No need to create a URL here, downloadURL is stored in Realtime Database
    const recording = this.recordings.find(r => r.fileName === fileName);
    return recording?.downloadURL;
  }
}