"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDisplayName } from "@/app/account/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
};

export function EditDisplayNameDialog({
  open,
  onOpenChange,
  currentName,
}: Props) {
  const [name, setName] = useState(currentName);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateDisplayName(formData);
      if (result.ok) {
        toast.success("Name updated");
        onOpenChange(false);
      } else {
        toast.error("Couldn't update", { description: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit display name</DialogTitle>
            <DialogDescription>
              This is the name your colleagues see on the leaderboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              name="display_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              minLength={1}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim().length === 0}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
