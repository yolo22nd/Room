package com.company.RoomsNDoors;

import com.company.Base;
import com.company.You;

public class Door4 extends Base {
    public String object = "Door";
    public static String name = "a Door";
    public static boolean locked = false;
    public static int sectorPosition;
    public static int position=-10;
    public void setPosition(int sectorPosition) {
        Door4.sectorPosition = sectorPosition;
        position=34;
    }

    public static boolean getLocked(){
        setLocked();
        return locked;
    }

    public static void setLocked(){
        locked=true;
        if (Hell.position!=23){
            Door4.locked=false;
        }
        if (You.haveHellKeys){
            locked=false;
        }
        if (doorOpen4){
            locked=false;
        }
    }
    public static boolean doorOpen4 = false;

    public static void openDoor() {
        if (getLocked()==false) {
            if (doorOpen4) {
                System.out.println("the door is already Open");
            } else {
                System.out.println("you opened the door");
                doorOpen4 = true;
            }
        }else if(You.haveShowKeys){
            System.out.println("you tried the key but it did not fit.\n" +
                    "maybe it goes into something else.");
        }else{
            System.out.println("the door is locked\n" +
                    "you don't have its key");
        }
    }

    public static void closeDoor() {
            if (!doorOpen4) {
                System.out.println("the door is already closed");
            } else {
                System.out.println("you closed the door");
                doorOpen4 = false;
            }
    }
    @Override
    public void printMap(int sectorPosition) {
        Base.SectorPositionDoor4=sectorPosition;
        setPosition(sectorPosition);
        setHere(object,position);
        super.printMap(position);
        if(getLocked()){
            System.out.println("it appears to be locked");
        }
    }
}
