'use client';

import React, { useState } from 'react';
import { Link } from "next/link";

export default function Usecard() {
  const [likes, setLikes] = useState(0);

  const handleLike = () => {
    setLikes((currentLikes) => currentLikes + 1);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>User Profile</h2>
            <p>Welcome back to your dashboard!</p>

            <button onClick={handleLike}>
                Likes: {likes}
            </button>

            <div style={{ marginTop: '15px' }}>
                <Link to="/profile/settings">Go to Profile Settings</Link>
            </div>
        </div>);

}