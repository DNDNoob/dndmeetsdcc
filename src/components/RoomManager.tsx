import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useGame } from "@/contexts/GameContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Copy, Check, LogOut } from "lucide-react";

export const RoomManager = () => {
  const { roomId, setRoomId } = useGame();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputRoomId, setInputRoomId] = useState("");
  const [copied, setCopied] = useState(false);

  // Check URL for room parameter on mount
  useEffect(() => {
    const urlRoomId = searchParams.get('room');
    if (urlRoomId && !roomId) {
      setRoomId(urlRoomId);
    }
  }, []);

  // Generate invite link (always points to /multiplayer with room param)
  const inviteLink = roomId
    ? `${window.location.origin}/multiplayer?room=${roomId}`
    : "";

  // Create new room
  const handleCreateRoom = () => {
    const newRoomId = crypto.randomUUID();
    setRoomId(newRoomId);
    setSearchParams({ room: newRoomId });
  };

  // Join existing room
  const handleJoinRoom = () => {
    if (inputRoomId.trim()) {
      setRoomId(inputRoomId.trim());
      setSearchParams({ room: inputRoomId.trim() });
    }
  };

  // Leave room
  const handleLeaveRoom = () => {
    setRoomId(null);
    setInputRoomId("");
    setSearchParams({});
  };

  // Copy invite link to clipboard
  const handleCopyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Solo mode (local only)
  if (!roomId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Multiplayer Room
          </CardTitle>
          <CardDescription>
            Join or create a room to play with friends in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Button onClick={handleCreateRoom} className="w-full">
              Create New Room
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or join existing
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Enter room code..."
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <Button 
              onClick={handleJoinRoom}
              disabled={!inputRoomId.trim()}
            >
              Join
            </Button>
          </div>

          <Alert>
            <AlertDescription>
              Playing in <strong>Solo Mode</strong>. Data is saved locally. Create or join a room to play with others.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Multiplayer mode
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-500" />
          Connected to Room
        </CardTitle>
        <CardDescription>
          Changes sync in real-time with all players in this room
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            <strong>Multiplayer Active!</strong> All changes sync instantly with other players.
          </AlertDescription>
        </Alert>

        <div>
          <label className="text-sm font-medium mb-2 block">Room Code</label>
          <div className="flex gap-2">
            <Input
              value={roomId}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              title="Copy invite link"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {inviteLink && (
          <div>
            <label className="text-sm font-medium mb-2 block">Invite Link</label>
            <div className="p-3 bg-muted rounded-md text-sm font-mono break-all">
              {inviteLink}
            </div>
          </div>
        )}

        <Button 
          onClick={handleLeaveRoom}
          variant="outline"
          className="w-full"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Leave Room
        </Button>
      </CardContent>
    </Card>
  );
};
